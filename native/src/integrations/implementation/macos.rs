use std::cmp::Ordering;
use std::convert::TryInto;
use std::fs::{create_dir_all, remove_dir_all, remove_file, write, File, Permissions};
use std::io::{BufWriter, Read, Write};
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::process::{Child, Command};

use anyhow::{bail, Context, Result};
use data_url::DataUrl;
use icns::{IconFamily, IconType, Image, PixelFormat};
use image::imageops::resize;
use image::imageops::FilterType::Gaussian;
use image::{DynamicImage, Rgba, RgbaImage};
use log::{debug, info};
use phf::phf_map;
use pix::rgb::{Rgba32, Rgba8};
use pix::Raster;
use rusttype::Point;
use url::Url;
use web_app_manifest::resources::IconResource;
use web_app_manifest::types::{ImagePurpose, ImageSize};

use crate::components::site::Site;
use crate::directories::ProjectDirs;
use crate::integrations::categories::MACOS_CATEGORIES;
use crate::integrations::{generate_icon, is_icon_supported, SiteInfoInstall, SiteInfoUninstall};

const BASE_DIRECTORIES_ERROR: &str = "Failed to determine base system directories";
const CONVERT_ICON_URL_ERROR: &str = "Failed to convert icon URL";
const DATA_URL_PROCESS_ERROR: &str = "Failed to process icon data URL";
const DATA_URL_DECODE_ERROR: &str = "Failed to decode icon data URL";
const DOWNLOAD_ICON_ERROR: &str = "Failed to download icon";
const READ_ICON_ERROR: &str = "Failed to read icon";
const LOAD_ICON_ERROR: &str = "Failed to load icon";
const SAVE_ICON_ERROR: &str = "Failed to save icon";
const CREATE_ICON_DIRECTORY_ERROR: &str = "Failed to create icon directory";
const CREATE_ICON_FILE_ERROR: &str = "Failed to create icon file";
const WRITE_ICON_FILE_ERROR: &str = "Failed to write icon file";
const CREATE_APPLICATION_DIRECTORY_ERROR: &str = "Failed to create application directory";
const WRITE_APPLICATION_FILE_ERROR: &str = "Failed to write application file";
const STORE_ICONS_ERROR: &str = "Failed to store icons";
const LAUNCH_APPLICATION_BUNDLE: &str = "Failed to launch site via system integration";
const APP_BUNDLE_NAME_ERROR: &str = "Failed to get name of app bundle";
const APP_BUNDLE_UNICODE_ERROR: &str = "Failed to check name of app bundle for Unicode validity";
const GENERATE_ICON_ERROR: &str = "Failed to generate icon";
const GET_LETTER_ERROR: &str = "Failed to get first letter";

const ICON_SAFE_ZONE_FACTOR: f64 = 0.697265625;

struct MacOSIconSize {
    size: u32,
    hdpi: bool,
}

impl MacOSIconSize {
    fn icon_type(&self) -> IconType {
        match (&self.size, &self.hdpi) {
            (16, false) => IconType::RGBA32_16x16,
            (16, true) => IconType::RGBA32_16x16_2x,
            (32, false) => IconType::RGBA32_32x32,
            (32, true) => IconType::RGBA32_32x32_2x,
            (64, false) => IconType::RGBA32_64x64,
            (128, false) => IconType::RGBA32_128x128,
            (128, true) => IconType::RGBA32_128x128_2x,
            (256, false) => IconType::RGBA32_256x256,
            (256, true) => IconType::RGBA32_256x256_2x,
            (512, false) => IconType::RGBA32_512x512,
            (512, true) => IconType::RGBA32_512x512_2x,
            _ => panic!("macOS does not support icon of size {}", self.size),
        }
    }

    fn size(&self) -> u32 {
        if self.hdpi {
            self.size * 2
        } else {
            self.size
        }
    }
}

fn store_icons(target: &Path, info: &SiteInfoInstall) -> Result<()> {
    let mut iconset = IconFamily::new();
    let icon_sizes = [
        MacOSIconSize { size: 16, hdpi: false },
        MacOSIconSize { size: 16, hdpi: true },
        MacOSIconSize { size: 32, hdpi: false },
        MacOSIconSize { size: 32, hdpi: true },
        MacOSIconSize { size: 64, hdpi: false },
        MacOSIconSize { size: 128, hdpi: false },
        MacOSIconSize { size: 128, hdpi: true },
        MacOSIconSize { size: 256, hdpi: false },
        MacOSIconSize { size: 256, hdpi: true },
        MacOSIconSize { size: 512, hdpi: false },
        MacOSIconSize { size: 512, hdpi: true },
    ];

    let icons = normalize_icons(info.icons);
    let mut icon_index = 0;
    let mut best_fallback: Option<&&IconResource> = None;

    // Download and store all icons
    // Icons need to be processed (scaled to the right sizes and masked)
    'sizes: for required_size in &icon_sizes {
        debug!("Looking for icon size {}", required_size.size());
        'icons: loop {
            let icon = match icons.get(icon_index).or(best_fallback) {
                Some(icon) => icon,
                None => break 'sizes,
            };

            debug!("Got icon with sizes {:?}", icon.sizes);

            let size = match icon.sizes.iter().max() {
                Some(size) => size.clone(),
                None => ImageSize::Any,
            };

            // We have to find the best fallback for when we run out of icons,
            // but still need more of them to satisfy the platform requirements.
            match best_fallback {
                Some(fallback) => {
                    let fallback_size = fallback.sizes.iter().max().unwrap_or(&ImageSize::Any);

                    if fallback_size > &size
                        || (fallback_size == &size
                            && icon.purpose.contains(&ImagePurpose::Maskable))
                    {
                        best_fallback = Some(icon);
                    }
                }

                None => best_fallback = Some(icon),
            }

            // If the size is smaller than what we need we pass,
            // except if we are alredy down to our last option.
            if size < ImageSize::Fixed(required_size.size(), required_size.size())
                && icon_index < icons.len()
            {
                icon_index += 1;
                continue 'icons;
            }

            debug!("Icon fits!");

            // Download the image from the URL
            let url: Url = icon.src.clone().try_into().context(CONVERT_ICON_URL_ERROR)?;
            let mut response = reqwest::blocking::get(url).context(DOWNLOAD_ICON_ERROR)?;

            let bytes = &response.bytes().context(READ_ICON_ERROR)?;
            let mut img = image::load_from_memory(bytes)
                .context(LOAD_ICON_ERROR)?
                .resize_to_fill(required_size.size(), required_size.size(), Gaussian)
                .into_rgba8();

            mask_icon(&mut img, icon.purpose.contains(&ImagePurpose::Maskable))?;

            iconset.add_icon_with_type(
                &Image::from_data(
                    PixelFormat::RGBA,
                    required_size.size(),
                    required_size.size(),
                    img.to_vec(),
                )?,
                required_size.icon_type(),
            );

            debug!("Added size {}", required_size.size());

            break 'icons;
        }
    }

    if iconset.is_empty() {
        let letter = info.name.chars().next().context(GET_LETTER_ERROR)?;

        for size in &icon_sizes {
            let image_data = generate_icon(letter, size.size()).context(GENERATE_ICON_ERROR)?;
            let mut image = DynamicImage::ImageRgb8(image_data).into_rgba8();

            mask_icon(&mut image, true);

            iconset.add_icon_with_type(
                &Image::from_data(PixelFormat::RGBA, size.size(), size.size(), image.to_vec())?,
                size.icon_type(),
            );
        }
    }

    let iconset_writer =
        BufWriter::new(File::create(target.join("app.icns")).context(CREATE_ICON_FILE_ERROR)?);
    iconset.write(iconset_writer).context(WRITE_APPLICATION_FILE_ERROR)?;
    Ok(())
}

fn create_application_entry(info: &SiteInfoInstall, exe: &str) -> Result<()> {
    // App ID is based on ste site ID
    let appid = format!("FFPWA-{}", &info.id);

    // Process some known manifest categories and reformat them into Apple names
    // Apps can only have one category, so we will only use the first one
    let category = if let Some(category) = info.categories.first() {
        // Make category lower-case and remove all word separators for easier matching
        let category = category.to_lowercase().replace("-", "").replace("_", "").replace(" ", "");

        // Get the mapped Apple category based on the site categories
        match MACOS_CATEGORIES.get(&category) {
            Some(category) => category,
            None => "",
        }
    } else {
        ""
    };

    // Get the applications directory and other paths
    let directory = directories::BaseDirs::new()
        .context(BASE_DIRECTORIES_ERROR)?
        .home_dir()
        .join("Applications");

    let bundle = directory.join(format!("{}.app", info.name));
    let bundle_contents = bundle.join("Contents");
    let info_plist = bundle_contents.join("info.plist");
    let pkg_info = bundle_contents.join("PkgInfo");
    let binary_dir = bundle_contents.join("MacOS");
    let resources_dir = bundle_contents.join("Resources");
    let loader = binary_dir.join("loader");

    // Store the entry data
    let mut info_plist_content = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>loader</string>
    <key>CFBundleIdentifier</key>
    <string>si.filips.firefoxpwa.site.{id}</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>{name}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleSignature</key>
    <string>{appid}</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>CFBundleIconFile</key>
    <string>app.icns</string>
    <key>LSApplicationCategoryType</key>
    <string>{category}</string>
</dict>
</plist>
",
        id = &info.id,
        name = &info.name,
        appid = &appid,
        category = &category,
    );

    let pkg_info_content = format!("APPL{}", appid);

    let loader_content = format!(
        "#!/usr/bin/env sh

{exe} site launch --direct-launch {id} \"$@\"
    ",
        exe = &exe,
        id = &info.id,
    );

    // Create the directory and write the file
    create_dir_all(&bundle_contents).context(CREATE_APPLICATION_DIRECTORY_ERROR)?;
    create_dir_all(binary_dir).context(CREATE_APPLICATION_DIRECTORY_ERROR)?;
    create_dir_all(&resources_dir).context(CREATE_APPLICATION_DIRECTORY_ERROR)?;
    write(info_plist, info_plist_content).context(WRITE_APPLICATION_FILE_ERROR)?;
    write(pkg_info, pkg_info_content).context(WRITE_APPLICATION_FILE_ERROR)?;
    store_icons(&resources_dir, info).context(STORE_ICONS_ERROR)?;

    let mut loader_file = File::create(loader).context(WRITE_APPLICATION_FILE_ERROR)?;
    let loader_permissions = Permissions::from_mode(0o755);
    let loader_file_content: &[u8] = loader_content.as_ref();

    loader_file.set_permissions(loader_permissions)?;
    loader_file.write_all(loader_file_content);

    // Our PWA app bundle is not signed with an apple developer certificate
    // By removing the quarantine attribute we can skip the signature verification
    Command::new("xattr")
        .args(["-rd", "com.apple.quarantine", bundle.to_str().unwrap()])
        .output()?;

    Ok(())
}

#[inline]
pub fn install(info: &SiteInfoInstall, dirs: &ProjectDirs) -> Result<()> {
    let exe = dirs.executables.join("firefoxpwa").display().to_string();
    create_application_entry(info, &exe).context("Failed to create application entry")?;
    Ok(())
}

fn remove_application_entry(info: &SiteInfoUninstall) -> Result<()> {
    let directory = directories::BaseDirs::new()
        .context(BASE_DIRECTORIES_ERROR)?
        .home_dir()
        .join("Applications");

    let filename = directory.join(format!("{}.app", info.name));

    verify_app_is_pwa(&filename, &info.id);
    remove_dir_all(filename);

    Ok(())
}

#[inline]
pub fn uninstall(info: &SiteInfoUninstall, _dirs: &ProjectDirs) -> Result<()> {
    remove_application_entry(info).context("Failed to remove application entry")?;
    Ok(())
}

fn verify_app_is_pwa(app_bundle: &Path, appid: &str) -> Result<()> {
    let mut pkg_info = File::open(app_bundle.join("Contents/PkgInfo"))?;
    let mut pkg_info_content = String::new();

    pkg_info.read_to_string(&mut pkg_info_content);
    debug!("{} should contain {}", pkg_info_content, appid);

    if pkg_info_content != format!("APPL{}", appid) {
        let bundle_name = app_bundle
            .file_name()
            .context(APP_BUNDLE_NAME_ERROR)?
            .to_str()
            .context(APP_BUNDLE_UNICODE_ERROR)?;

        bail!("{} is not a PWA", bundle_name);
    }

    Ok(())
}

pub fn launch(site: &Site, url: &Option<Url>, arguments: &[String]) -> Result<Child> {
    let name = site.name().unwrap_or_else(|| site.domain());

    let appid = format!("FFPWA-{}", site.ulid.to_string());
    let app_path = directories::BaseDirs::new()
        .context(BASE_DIRECTORIES_ERROR)?
        .home_dir()
        .join(format!("Applications/{}.app", name));

    debug!("Verifying that {} is a PWA app bundle", app_path.to_str().unwrap());
    if app_path.exists() {
        verify_app_is_pwa(&app_path, &appid)?;
    }

    let mut args = vec![app_path.display().to_string()];

    // We need to append `--args` when we provide additional arguments to the PWA
    if url.is_some() || !arguments.is_empty() {
        args.extend_from_slice(&["--args".into()]);
    }

    // Support launching PWA with custom URLs
    if let Some(url) = url {
        #[rustfmt::skip]
        args.extend_from_slice(&[
            "--url".into(), url.to_string(),
        ]);
    }

    // Support launching PWA with custom Firefox arguments
    if !arguments.is_empty() {
        args.extend_from_slice(&["---".into()]);
        args.extend_from_slice(arguments);
    }

    let mut command = Command::new("open");
    command.args(&args).spawn().context(LAUNCH_APPLICATION_BUNDLE)
}

// We filter out all unusable icons before attempting to find the right icon sizes
fn normalize_icons(icons: &[IconResource]) -> Vec<&IconResource> {
    let mut icons: Vec<&IconResource> = icons
    .iter()
    // We can only use icons with purpose any or maskable
    .filter(|icon| icon.purpose.contains(&ImagePurpose::Any) || icon.purpose.contains(&ImagePurpose::Maskable))
    // We can not use SVG icons because the image crate doesn't support them
    .filter(|icon| icon.r#type.as_ref().map_or(true, |_type| _type.subtype() != "svg+xml"))
    // Skip data URLs because supporting them would make code a lot more complicated
    .filter(|icon| {
        match icon.src.clone().try_into().context(CONVERT_ICON_URL_ERROR) as Result<Url> {
            Ok(url) => url.scheme() != "data",
            Err(_) => false
        }
    })
    .collect();

    // We prefer maskable icons so we put them at the start of the list
    icons.sort_by(|a, b| {
        if a.purpose.contains(&ImagePurpose::Maskable)
            && b.purpose.contains(&ImagePurpose::Maskable)
        {
            Ordering::Equal
        } else if a.purpose.contains(&ImagePurpose::Maskable) {
            Ordering::Less
        } else if b.purpose.contains(&ImagePurpose::Maskable) {
            Ordering::Greater
        } else {
            Ordering::Equal
        }
    });

    icons
}

// apply the the correct icon shape specified by apple for macOS
// Source: https://developer.apple.com/design/human-interface-guidelines/macos/icons-and-images/app-icon/
fn mask_icon(icon: &mut RgbaImage, maskable: bool) -> Result<()> {
    let icon_size = Point { x: icon.width(), y: icon.height() };
    let mask = image::load_from_memory(include_bytes!("../../assets/icon-mask-macos.png"))?;
    let shadow = image::load_from_memory(include_bytes!("../../assets/icon-shadow-macos.png"))?;
    let scaled_mask = mask.resize(icon_size.x, icon_size.y, Gaussian); // this is really slow in debug builds, up to ~1s
    let scaled_shadow = shadow.resize(icon_size.x, icon_size.y, Gaussian); // this is really slow in debug builds, up to ~1s
    let mask_data = scaled_mask.into_rgba8();
    let shadow_data = scaled_shadow.into_rgba8();

    let scaled_icon_size = if maskable {
        Point { x: icon_size.x as u32, y: icon_size.y as u32 }
    } else {
        Point {
            x: (icon_size.x as f64 * ICON_SAFE_ZONE_FACTOR).round() as u32,
            y: (icon_size.y as f64 * ICON_SAFE_ZONE_FACTOR).round() as u32,
        }
    };

    let icon_offset = Point {
        x: (icon_size.x - scaled_icon_size.x) / 2,
        y: (icon_size.y - scaled_icon_size.y) / 2,
    };

    let scaled_icon_data: RgbaImage = if maskable {
        icon.clone()
    } else {
        resize(icon, scaled_icon_size.x, scaled_icon_size.y, Gaussian)
    };

    let mut icon_background =
        RgbaImage::from_pixel(icon_size.x, icon_size.y, Rgba([255, 255, 255, 255]));

    for pixel in icon_background.enumerate_pixels() {
        let (pixel_x, pixel_y, original_pixel_value) = pixel;

        let mut pixel_value = original_pixel_value.to_owned();
        let icon_pixel_x = pixel_x as i32 - icon_offset.x as i32;
        let icon_pixel_y = pixel_y as i32 - icon_offset.y as i32;

        // add icon into background
        if icon_pixel_x >= 0
            && icon_pixel_y >= 0
            && icon_pixel_x < scaled_icon_size.x as i32
            && icon_pixel_y < scaled_icon_size.y as i32
        {
            let icon_pixel = scaled_icon_data.get_pixel(icon_pixel_x as u32, icon_pixel_y as u32);
            let pixel_alpha = icon_pixel.0[3] as f64 / 255f64;
            let pixel_r = (icon_pixel.0[0] as f64 * pixel_alpha).round();
            let pixel_g = (icon_pixel.0[1] as f64 * pixel_alpha).round();
            let pixel_b = (icon_pixel.0[2] as f64 * pixel_alpha).round();

            pixel_value.0[0] =
                ((pixel_value.0[0] as f64 * (1f64 - pixel_alpha)).round() + pixel_r) as u8;
            pixel_value.0[1] =
                ((pixel_value.0[1] as f64 * (1f64 - pixel_alpha)).round() + pixel_g) as u8;
            pixel_value.0[2] =
                ((pixel_value.0[2] as f64 * (1f64 - pixel_alpha)).round() + pixel_b) as u8;
        }

        // apply mask to icon
        let mask_pixel = mask_data.get_pixel(pixel_x, pixel_y);

        pixel_value.0[3] = mask_pixel.0[0];

        // add shadow to composed icon
        if (pixel_value.0[3] == 0) {
            let shadow_pixel = shadow_data.get_pixel(pixel_x, pixel_y);

            pixel_value.0 = shadow_pixel.0;
        }

        // write pixel data to original icon
        icon.put_pixel(pixel_x, pixel_y, pixel_value);
    }

    Ok(())
}
