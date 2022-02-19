#![allow(dead_code)]

use std::cmp::Ordering;
use std::convert::TryInto;
use std::path::Path;

use anyhow::{bail, Context, Result};
use data_url::DataUrl;
use image::imageops::FilterType::Gaussian;
use image::{ImageBuffer, Rgb, RgbImage};
use log::{debug, error, warn};
use rusttype::{point, Font, Scale};
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
/// at the start are also removed to prevent the file from being hidden.
#[cfg(any(target_os = "windows", target_os = "macos"))]
pub fn sanitize_name<'a>(name: &'a str, id: &'a str) -> String {
    let mut sanitized: String = name.chars().take(60).collect();
    sanitized = sanitized.trim_start_matches(&[' ', '.']).into();
    sanitized = sanitize_filename::sanitize(sanitized);

    if sanitized.is_empty() {
        format!("Site {}", &id)
    } else {
        sanitized
    }
}

/// Download the icon from the URL.
///
/// Icon can be downloaded from the network using the `reqwest` crate
/// or decoded from a data URL. Once downloaded, the function returns
/// the icon bytes and its content type.
pub fn download_icon(url: Url) -> Result<(Vec<u8>, String)> {
    // Download using `reqwest`
    if url.scheme() != "data" {
        let response = reqwest::blocking::get(url)?;
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

/// Generate an icon from a letter.
pub fn generate_icon(letter: char, size: &ImageSize) -> Result<RgbImage> {
    // Icon must have a fixed size
    let size = match size {
        ImageSize::Fixed(a, b) => (a, b),
        _ => bail!("A fixed image size variant must be provided"),
    };

    // Load the font from OTF file
    let bytes = include_bytes!("../../assets/Metropolis-SemiBold.otf");
    let font = Font::try_from_bytes(bytes as &[u8]).context("Failed to construct the font")?;

    // Check if glyph exists in font
    if font.glyph(letter).id().0 == 0 {
        bail!("Font does not support glyph \"{}\"", letter);
    }

    // Layout the first (and only) glyph
    let scale = Scale::uniform(*size.1 as f32 / 1.6);
    let glyph = font
        .layout(letter.encode_utf8(&mut [0; 4]), scale, point(0.0, font.v_metrics(scale).ascent))
        .next()
        .context("Failed to layout the glyph")?;

    // Store the background and foreground colors
    let background = Rgb([80, 80, 80]);
    let foreground = Rgb([255, 255, 255]);

    // Create a new RGBA image with a gray background
    let mut image: RgbImage = ImageBuffer::from_pixel(*size.0, *size.1, background);

    if let Some(bounding_box) = glyph.pixel_bounding_box() {
        // Get the glyph width and height
        let width = (bounding_box.max.x - bounding_box.min.x) as u32;
        let height = (bounding_box.max.y - bounding_box.min.y) as u32;

        // Check for glyph size overflows
        // This shouldn't happen, but just in case
        if width > *size.0 || height > *size.1 {
            bail!("Glyph is bigger than image");
        }

        // Calculate the offset so the glyph is in the middle
        let offset_x = (size.0 - width) / 2;
        let offset_y = (size.1 - height) / 2;

        // Draw the glyph into the image per-pixel by using the draw closure
        glyph.draw(|x, y, v| {
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

/// Obtain and process the best available icon from the icon list.
///
/// Icon needs to be processed and converted to a correct format (determined from
/// the filename). In case anything fails, the next icons are tried. If no provided
/// icons are working, the icon is generated from the first letter of the name.
///
/// See [`normalize_icons`] and [`process_icon`] for more details.
///
/// # Parameters
///
/// - `icons`: A list of available icons for the site or shortcut.
/// - `fallback`:  A site or shortcut name. Used to generate a fallback icon.
/// - `size`: A target icon size. Must be a valid fixed (non-zero) size variant.
/// - `path`:  A path where the icon should be saved.
///
pub fn process_icons(
    icons: &[IconResource],
    fallback: &str,
    size: &ImageSize,
    path: &Path,
) -> Result<()> {
    for icon in normalize_icons(icons, size) {
        match process_icon(icon, size, path).context("Failed to process icon") {
            Ok(_) => return Ok(()),
            Err(error) => {
                error!("{:?}", error);
                warn!("Falling back to the next available icon");
            }
        }
    }

    warn!("No compatible or working icon was found");
    warn!("Falling back to the generated icon from the name");
    let letter = fallback.chars().next().context("Failed to get the first letter")?;
    let icon = generate_icon(letter, size).context("Failed to generate icon")?;
    icon.save(path).context("Failed to save generated image")?;
    Ok(())
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
/// All icons are first filtered to remove unsupported icons, and then sorted
/// by their largest size. Icons larger than the target icon size are sorted
/// in the ascending order, and others are sorted in descending.
fn normalize_icons<'a>(icons: &'a [IconResource], size: &'a ImageSize) -> Vec<&'a IconResource> {
    let mut icons: Vec<&IconResource> = icons.iter().filter(is_icon_supported).collect();

    icons.sort_by(|icon1, icon2| {
        let size1 = icon1.sizes.iter().max();
        let size2 = icon2.sizes.iter().max();

        if size1.is_none() || size2.is_none() {
            return Ordering::Equal;
        };

        // Unwrap is safe, because sizes is checked above
        let size1 = size1.unwrap();
        let size2 = size2.unwrap();

        if size1 >= size && size2 >= size {
            size1.cmp(size2)
        } else {
            size1.cmp(size2).reverse()
        }
    });

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
///
fn process_icon(icon: &IconResource, size: &ImageSize, path: &Path) -> Result<()> {
    let size = match size {
        ImageSize::Fixed(a, b) => (a, b),
        _ => bail!("A fixed image size variant must be provided"),
    };

    let url: Url = icon.src.clone().try_into().context("Failed to convert icon URL")?;
    debug!("Processing icon {}", url);

    // Download icon and get its content type
    let (content, content_type) = download_icon(url).context("Failed to download icon")?;

    if content_type == "image/svg+xml" {
        debug!("Processing as SVG icon");

        let mut options = usvg::Options::default();
        options.fontdb.load_system_fonts();

        let mut pixmap = tiny_skia::Pixmap::new(*size.0, *size.1).context("Invalid target size")?;
        let transform = tiny_skia::Transform::default();

        // Parse and render SVG icons using `usvg` and `resvg` crates
        let rtree = usvg::Tree::from_data(&content, &options.to_ref())
            .context("Failed to parse SVG icon")?;
        resvg::render(&rtree, usvg::FitTo::Size(*size.0, *size.1), transform, pixmap.as_mut())
            .context("Failed to render SVG icon")?;
        image::save_buffer(&path, pixmap.data(), *size.0, *size.1, image::ColorType::Rgba8)
            .context("Failed to save SVG icon")?;

        return Ok(());
    }

    // Parse raster icons using the `image` crate, resize them and store them to a file
    debug!("Processing as raster icon");
    let mut img = image::load_from_memory(&content).context("Failed to load icon")?;
    img = img.resize(*size.0, *size.1, Gaussian);
    img.save(&path).context("Failed to save icon")?;

    Ok(())
}
