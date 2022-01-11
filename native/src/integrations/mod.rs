#![allow(unused)]

use std::path::Path;
use std::process::{Child, Command};

use anyhow::{bail, Context, Result};
use cfg_if::cfg_if;
use image::{ImageBuffer, Pixel, Rgb, RgbImage};
use log::warn;
use rusttype::{point, Font, Scale};
use url::Url;
use web_app_manifest::resources::{IconResource, ShortcutResource};
use web_app_manifest::types::{ImagePurpose, Url as ManifestUrl};

use crate::components::site::Site;
use crate::console::Run;
use crate::directories::ProjectDirs;

#[cfg(any(target_os = "linux", target_os = "macos"))]
mod categories;

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "linux")]
mod linux;

#[cfg(target_os = "macos")]
mod macos;

#[derive(Debug, Eq, PartialEq, Clone)]
pub struct SiteInfoInstall<'a> {
    id: String,
    url: String,
    domain: String,
    name: String,
    description: String,
    categories: &'a Vec<String>,
    keywords: &'a Vec<String>,
    icons: &'a Vec<IconResource>,
    shortcuts: &'a Vec<ShortcutResource>,
}

#[derive(Debug, Eq, PartialEq, Clone)]
pub struct SiteInfoUninstall {
    id: String,
    name: String,
}

#[inline]
pub fn install(site: &Site, dirs: &ProjectDirs) -> Result<()> {
    // Site ID is used to generate all commands and as an identifier at various places
    let id = site.ulid.to_string();

    // Start URL is used as an info URL in ARP
    // First try the user-specified start URL, then try manifest start URL
    let url = if let Some(url) = &site.config.start_url {
        url.to_string()
    } else if let ManifestUrl::Absolute(url) = &site.manifest.start_url {
        url.to_string()
    } else {
        unreachable!("Site without valid absolute URL is not possible")
    };

    let domain = site.domain();
    let name = site.name().unwrap_or_else(|| domain.clone());

    // First try the user-specified description, then try manifest description
    let description = if let Some(description) = &site.config.description {
        description.clone()
    } else if let Some(description) = &site.manifest.description {
        description.clone()
    } else {
        "".into()
    };

    // Categories can be used for user organization of sites and describe in which categories does site belong
    // There is no fixed list of categories, but some known categories will be converted to XDG menu categories on Linux
    // First try the user-specified categories, then try manifest categories
    let categories = if !site.config.categories.is_empty() {
        &site.config.categories
    } else {
        &site.manifest.categories
    };

    // Keywords can also be used for user organization of sites and contain additional words that can describe the site
    // Keywords will be converted to XDG menu keywords on Linux and be used as additional search queries
    // First try the user-specified keywords, then try manifest keywords
    let keywords = if !site.config.keywords.is_empty() {
        &site.config.keywords
    } else {
        &site.manifest.keywords
    };

    // Generate site info struct
    let info = SiteInfoInstall {
        id,
        url,
        domain,
        name,
        description,
        categories,
        keywords,
        icons: &site.manifest.icons,
        shortcuts: &site.manifest.shortcuts,
    };

    // Apply system integration
    cfg_if! {
        if #[cfg(target_os = "windows")] {
            windows::install(&info, dirs)
        } else if #[cfg(target_os = "linux")] {
            linux::install(&info, dirs)
        } else if #[cfg(target_os = "macos")] {
            macos::install(&info, dirs)
        } else {
            compile_error!("Unknown operating system");
        }
    }
}

#[inline]
pub fn uninstall(site: &Site, dirs: &ProjectDirs) -> Result<()> {
    let id = site.ulid.to_string();
    let name = site.name().unwrap_or_else(|| site.domain());

    // Generate site info struct
    let info = SiteInfoUninstall { id, name };

    // Unapply system integration
    cfg_if! {
        if #[cfg(target_os = "windows")] {
            windows::uninstall(&info, dirs)
        } else if #[cfg(target_os = "linux")] {
            linux::uninstall(&info)
        } else if #[cfg(target_os = "macos")] {
            macos::uninstall(&info)
        } else {
            compile_error!("Unknown operating system");
        }
    }
}

#[cfg(target_os = "macos")]
#[inline]
pub fn launch(site: &Site, url: &Option<Url>, arguments: &[String]) -> Result<Child> {
    macos::launch(site, url, arguments)
}

/// Util: Generate the icon from the first letter of the site/shortcut name
fn generate_icon_internal(letter: char, size: u32) -> Result<RgbImage> {
    // Load the font from OTF file
    let bytes = include_bytes!("../../assets/Metropolis-SemiBold.otf");
    let font = Font::try_from_bytes(bytes as &[u8]).context("Failed to construct the font")?;

    // Check if glyph exists in font
    if font.glyph(letter).id().0 == 0 {
        bail!("Font does not support glyph \"{}\"", letter);
    }

    // Layout the first (and only) glyph
    let scale = Scale::uniform(size as f32 / 1.6);
    let glyph = font
        .layout(letter.encode_utf8(&mut [0; 4]), scale, point(0.0, font.v_metrics(scale).ascent))
        .next()
        .context("Failed to layout the glyph")?;

    // Store the background and foreground colors
    let background = Rgb([80, 80, 80]);
    let foreground = Rgb([255, 255, 255]);

    // Create a new RGBA image with a gray background
    let mut image: RgbImage = ImageBuffer::from_pixel(size, size, background);

    if let Some(bounding_box) = glyph.pixel_bounding_box() {
        // Get the glyph width and height
        let width = (bounding_box.max.x - bounding_box.min.x) as u32;
        let height = (bounding_box.max.y - bounding_box.min.y) as u32;

        // Check for glyph size overflows
        // This shouldn't happen, but just in case
        if width > size || height > size {
            bail!("Glyph is bigger than image");
        }

        // Calculate the offset so the glyph is in the middle
        let offset_x = (size - width) / 2;
        let offset_y = (size - height) / 2;

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

/// Util: Generate the icon and save it to file
#[cfg(not(target_os = "macos"))]
#[inline]
pub(in crate::integrations) fn generate_icon<P: AsRef<Path>>(
    letter: char,
    size: u32,
    filename: P,
) -> Result<()> {
    generate_icon_internal(letter, size)?.save(filename).context("Failed to save generated image")
}

/// Util: Generate the icon and return it
#[cfg(target_os = "macos")]
#[inline]
pub(in crate::integrations) fn generate_icon(letter: char, size: u32) -> Result<RgbImage> {
    generate_icon_internal(letter, size)
}
