#![allow(dead_code)]

use std::path::Path;

use ab_glyph::{Font, FontRef, PxScale};
use anyhow::{Context, Result, bail};
use data_url::DataUrl;
use image::imageops::Lanczos3;
use image::{ImageBuffer, Rgb, RgbImage, RgbaImage};
use log::{debug, error, warn};
use reqwest::blocking::Client;
use resvg::{tiny_skia, usvg};
use url::Url;
use web_app_manifest::resources::IconResource;
use web_app_manifest::types::{ImagePurpose, ImageSize, Url as ManifestUrl};

//////////////////////////////
// Public
//////////////////////////////

/// Remove all invalid filename characters and limit the length.
///
/// Name is capped at 60 characters is sanitized using the [`sanitize_filename`]
/// crate to prevent it from containing any invalid filenames characters. Dots
/// at the start are also removed to prevent the file from being hidden. In case
/// the sanitized name is an empty string, the new name is constructed from the ID.
#[cfg(any(platform_windows, platform_macos))]
pub fn sanitize_name<'a>(name: &'a str, id: &'a str) -> String {
    let mut sanitized: String = name.chars().take(60).collect();
    sanitized = sanitized.trim_start_matches([' ', '.']).into();
    sanitized = sanitize_filename::sanitize(sanitized);

    if sanitized.is_empty() { format!("Site {}", &id) } else { sanitized }
}

/// Normalize category name.
///
/// Category name is converted to lower-case and all word separators (`-`, `_`, ` `)
/// are removed. This allows easier matching with keys from the categories map.
#[cfg(any(
    platform_linux,
    platform_macos,
    platform_bsd,
    all(platform_windows, feature = "portable")
))]
#[inline]
pub fn normalize_category_name(category: &str) -> String {
    category.to_lowercase().replace(['-', '_', ' '], "")
}

/// Download the icon from the URL.
///
/// Icon can be downloaded from the network using the `reqwest` crate
/// or decoded from a data URL. Once downloaded, the function returns
/// the icon bytes and its content type.
pub fn download_icon(url: Url, client: &Client) -> Result<(Vec<u8>, String)> {
    // Download using `reqwest`
    if url.scheme() != "data" {
        let response = client.get(url).send()?;
        let r#type = match response.headers().get(reqwest::header::CONTENT_TYPE) {
            Some(r#type) => r#type.to_str()?.into(),
            None => "application/octet-stream".into(),
        };
        let bytes = response.bytes()?.to_vec();
        Ok((bytes, r#type))

    // Download using `data-url`
    } else {
        let url = DataUrl::process(url.as_str())?;
        let r#type = url.mime_type().to_string();
        let (bytes, _) = url.decode_to_vec()?;
        Ok((bytes, r#type))
    }
}

/// Obtain the best available icon from the icon list and save it to a file.
///
/// Icons are first filtered and sorted using the [`normalize_icons`] function to
/// determine the best matching icons for the target size.
///
/// Icon needs to be processed and converted to a correct format (determined from
/// the filename). In case anything fails, the next icons are tried. If no provided
/// icons are working, the icon is generated from the first letter of the name.
///
/// See [`normalize_icons`] and [`process_icon`] for more details.
///
/// # Parameters
///
/// - `icons`: A list of available icons for the web app or shortcut.
/// - `fallback`: A web app or shortcut name. Used to generate a fallback icon.
/// - `size`: A target icon size. Must be a valid fixed (non-zero) size variant.
/// - `path`: A path where the icon should be saved.
/// - `client`: An instance of a blocking HTTP client.
///
pub fn store_icon(
    icons: &[IconResource],
    fallback: &str,
    size: &ImageSize,
    path: &Path,
    client: &Client,
) -> Result<()> {
    for icon in normalize_icons(icons, size) {
        match process_icon(icon, size, path, client).context("Failed to process icon") {
            Ok(_) => return Ok(()),
            Err(error) => {
                error!("{error:?}");
                warn!("Falling back to the next available icon");
            }
        }
    }

    warn!("No compatible or working icon was found");
    warn!("Falling back to the generated icon from the name");
    let letter = fallback.chars().next().context("Failed to get the first letter")?;
    let icon = generate_fallback_icon(letter, size).context("Failed to generate fallback icon")?;
    icon.save(path).context("Failed to save generated image")?;
    Ok(())
}

/// Create a single ICO file containing multiple sizes.
/// Icons are first filtered and sorted using the [`normalize_icons`] function to
/// determine the best matching icons for each target size.
///
/// Icon needs to be processed and converted to a correct format (determined from
/// the filename). In case anything fails, the next icons are tried. If no provided
/// icons are working, the icon is generated from the first letter of the name.
///
/// # Parameters
///
/// - `icons`: A list of available icons for the web app or shortcut.
/// - `fallback`: A web app or shortcut name. Used to generate a fallback icon.
/// - `size`: A list of target icon sizes.
/// - `path`: A path where the icon should be saved.
/// - `client`: An instance of a blocking HTTP client.
///
#[cfg(platform_windows)]
pub fn store_multisize_icon(
    icons: &[IconResource],
    fallback: &str,
    sizes: &[u32],
    path: &Path,
    client: &Client,
) -> Result<()> {
    let mut icondir = ico::IconDir::new(ico::ResourceType::Icon);

    for &size in sizes {
        for icon in normalize_icons(icons, &ImageSize::Fixed(size, size)) {
            if let Ok(rgba) = render_icon(icon, (size, size), client) {
                let image = ico::IconImage::from_rgba_data(size, size, rgba.into_raw());
                let entry =
                    ico::IconDirEntry::encode(&image).context("Failed to encode ICO entry")?;

                icondir.add_entry(entry);
                break;
            }
        }
    }

    if icondir.entries().is_empty() {
        warn!("No compatible or working icon was found");
        warn!("Falling back to the generated icon from the name");
        let letter = fallback.chars().next().context("Failed to get the first letter")?;

        for &size in sizes {
            let icon = generate_fallback_icon(letter, &ImageSize::Fixed(size, size))
                .context("Failed to generate fallback icon")?;
            let image = ico::IconImage::from_rgba_data(size, size, icon.into_raw());
            let entry = ico::IconDirEntry::encode(&image).context("Failed to encode ICO entry")?;
            icondir.add_entry(entry);
        }
    }

    let mut file = std::fs::File::create(path).context("Failed to create ICO file")?;
    icondir.write(&mut file).context("Failed to write ICO file")?;

    Ok(())
}

/// Generate a fallback icon from the provided letter.
pub fn generate_fallback_icon(letter: char, size: &ImageSize) -> Result<RgbImage> {
    // Icon must have a fixed size
    let size = match size {
        ImageSize::Fixed(a, b) => (a, b),
        _ => bail!("A fixed image size variant must be provided"),
    };

    // Load the font from OTF file
    let bytes = include_bytes!("../../assets/Metropolis-SemiBold.otf");
    let font = FontRef::try_from_slice(bytes).context("Failed to construct the font")?;

    // Get and scale the glyph
    let scale = PxScale::from(*size.1 as f32 / 1.6);
    let glyph = font.glyph_id(letter).with_scale(scale);

    // Store the background and foreground colors
    let background = Rgb([80, 80, 80]);
    let foreground = Rgb([255, 255, 255]);

    // Create a new RGBA image with a gray background
    let mut image: RgbImage = ImageBuffer::from_pixel(*size.0, *size.1, background);

    if let Some(outlined) = font.outline_glyph(glyph) {
        // Get the glyph width and height
        let bounds = outlined.px_bounds();
        let width = (bounds.max.x - bounds.min.x) as u32;
        let height = (bounds.max.y - bounds.min.y) as u32;

        // Check for glyph size overflows
        // This shouldn't happen, but just in case
        if width > *size.0 || height > *size.1 {
            bail!("Glyph is bigger than image");
        }

        // Calculate the offset so the glyph is in the middle
        let offset_x = (size.0 - width) / 2;
        let offset_y = (size.1 - height) / 2;

        // Draw the glyph into the image per-pixel by using the draw closure
        outlined.draw(|x, y, v| {
            // Convert the alpha value with the background
            let pixel = Rgb([
                ((1.0 - v) * background.0[0] as f32 + v * foreground.0[0] as f32) as u8,
                ((1.0 - v) * background.0[1] as f32 + v * foreground.0[1] as f32) as u8,
                ((1.0 - v) * background.0[2] as f32 + v * foreground.0[2] as f32) as u8,
            ]);

            // Put the glyph pixel into the image
            image.put_pixel(x + offset_x, y + offset_y, pixel)
        });
    }

    Ok(image)
}

//////////////////////////////
// Internal
//////////////////////////////

/// Check if the icon is supported.
///
/// Supported icons must contain "any" purpose and must only have absolute URLs.
/// Other icons cannot / should not be parsed and need to be ignored.
fn is_icon_supported(icon: &&IconResource) -> bool {
    // Normal icons must contain "any" purpose
    if !icon.purpose.contains(&ImagePurpose::Any) {
        return false;
    }

    // Only icons with absolute URLs can be used
    matches!(&icon.src, ManifestUrl::Absolute(_))
}

/// Filter out all incompatible icons and sort them.
///
/// Icons are first filtered to remove icons without the `any` purpose and
/// then sorted depending on their sizes.
///
/// Icons that match the target size exactly are preferred the most, followed
/// by icons with the `any` size. Next are icons larger than the target size
/// in the ascending order, and finally, icons smaller than the target size
/// in the descending order. Any icons without known sizes are placed last.
fn normalize_icons<'a>(icons: &'a [IconResource], size: &'a ImageSize) -> Vec<&'a IconResource> {
    let mut icons: Vec<&IconResource> = icons.iter().filter(is_icon_supported).collect();

    let key = |icon: &IconResource| {
        use std::cmp::Reverse;

        if icon.sizes.contains(size) {
            (0, None, None)
        } else if icon.sizes.contains(&ImageSize::Any) {
            (1, None, None)
        } else if let Some(smallest_larger) = icon.sizes.iter().filter(|s| *s >= size).min() {
            (2, Some(*smallest_larger), None)
        } else if let Some(largest_smaller) = icon.sizes.iter().filter(|s| *s <= size).max() {
            (3, None, Some(Reverse(*largest_smaller)))
        } else {
            (4, None, None)
        }
    };

    icons.sort_by_key(|icon| key(icon));
    icons
}

/// Process the icon and stores it to a file.
///
/// Icon can be downloaded from the network or from a data URL using
/// the [`download_icon`] function. Icon is then resized to a specified
/// size and stored to a file. Both SVG and raster icons are supported.
///
/// # Parameters
///
/// - `icon`: An icon resource representing the icon. Must provide an absolute icon URL.
/// - `size`: A target icon size. Must be a valid fixed (non-zero) size variant.
/// - `path`: A path where the icon should be stored.
/// - `client`: An instance of a blocking HTTP client.
///
fn process_icon(icon: &IconResource, size: &ImageSize, path: &Path, client: &Client) -> Result<()> {
    let size = match size {
        ImageSize::Fixed(a, b) => (*a, *b),
        _ => bail!("A fixed image size variant must be provided"),
    };

    let img = render_icon(icon, size, client)?;
    img.save(path).context("Failed to save icon")?;

    Ok(())
}

/// Download and render an icon into an RGBA image buffer of the given size.
fn render_icon(icon: &IconResource, size: (u32, u32), client: &Client) -> Result<RgbaImage> {
    let url: Url = icon.src.clone().try_into().context("Failed to convert icon URL")?;
    debug!("Rendering icon {url} to {}x{}", size.0, size.1);

    // Download the icon and get its content type
    let (content, content_type) = download_icon(url, client).context("Failed to download icon")?;

    if content_type == "image/svg+xml" {
        // Parse and render SVG icons using `resvg` crate
        debug!("Rendering as SVG icon");

        let mut pixmap = tiny_skia::Pixmap::new(size.0, size.1).context("Invalid target size")?;

        let mut opt = usvg::Options::default();

        // Load the system font database
        opt.fontdb_mut().load_system_fonts();

        // Prevent resolving external resources
        let resolver = Box::new(move |_: &str, _: &usvg::Options| None);
        opt.image_href_resolver.resolve_string = resolver;

        // Parse the icon source
        let tree = usvg::Tree::from_data(&content, &opt).context("Failed to parse SVG icon")?;

        let transform = tiny_skia::Transform::from_scale(
            size.0 as f32 / tree.size().width(),
            size.1 as f32 / tree.size().height(),
        );

        // Render the icon to the target size
        resvg::render(&tree, transform, &mut pixmap.as_mut());

        // Load the icon into an RGBA image
        let img = RgbaImage::from_raw(size.0, size.1, pixmap.take())
            .context("Failed to load SVG icon")?;

        return Ok(img);
    }

    // Load raster icons using the `image` crate and resize them
    debug!("Rendering as raster icon");
    let img = image::load_from_memory(&content).context("Failed to load raster icon")?;
    let img = img.resize(size.0, size.1, Lanczos3).into_rgba8();
    Ok(img)
}
