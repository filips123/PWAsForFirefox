use std::cmp::Ordering;
use std::convert::TryInto;
use std::fs::{create_dir_all, remove_dir_all, rename, write, File, Permissions};
use std::io::{BufWriter, Read, Write};
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::process::{Child, Command, Stdio};

use anyhow::{bail, Context, Result};
use icns::{IconFamily, IconType, Image, PixelFormat};
use image::imageops::resize;
use image::imageops::FilterType::Gaussian;
use image::{DynamicImage, Rgba, RgbaImage};
use log::{debug, error, warn};
use reqwest::blocking::Client;
use resvg::{tiny_skia, usvg};
use url::Url;
use web_app_manifest::resources::IconResource;
use web_app_manifest::types::{ImagePurpose, ImageSize, Url as ManifestUrl};

use crate::components::site::Site;
use crate::integrations::categories::MACOS_CATEGORIES;
use crate::integrations::utils::{
    download_icon,
    generate_icon,
    normalize_category_name,
    sanitize_name,
};
use crate::integrations::{IntegrationInstallArgs, IntegrationUninstallArgs};

const BASE_DIRECTORIES_ERROR: &str = "Failed to determine base system directories";
const CONVERT_ICON_URL_ERROR: &str = "Failed to convert icon URL";
const DOWNLOAD_ICON_ERROR: &str = "Failed to download icon";
const PROCESS_ICON_ERROR: &str = "Failed to process icon";
const LOAD_ICON_ERROR: &str = "Failed to load icon";
const MASK_ICON_ERROR: &str = "Failed to mask icon";
const CREATE_ICON_FILE_ERROR: &str = "Failed to create icon file";
const CREATE_TEMP_FILE_ERROR: &str = "Failed to create temporary file";
const CREATE_APPLICATION_DIRECTORY_ERROR: &str = "Failed to create application directory";
const WRITE_APPLICATION_FILE_ERROR: &str = "Failed to write application file";
const STORE_ICONS_ERROR: &str = "Failed to store icons";
const LAUNCH_APPLICATION_BUNDLE: &str = "Failed to launch web app via system integration";
const APP_BUNDLE_NAME_ERROR: &str = "Failed to get name of app bundle";
const APP_BUNDLE_UNICODE_ERROR: &str = "Failed to check name of app bundle for Unicode validity";
const GENERATE_ICON_ERROR: &str = "Failed to generate icon";
const GET_LETTER_ERROR: &str = "Failed to get first letter";

const ICON_SAFE_ZONE_FACTOR: f64 = 0.697265625;

#[derive(Debug, Clone, Copy)]
struct Point {
    x: u32,
    y: u32,
}

#[derive(Debug, Clone, Copy)]
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

//////////////////////////////
// Utils
//////////////////////////////

/// Filter out all incompatible icons.
///
/// This removes all icons without purpose "any" or "maskable", or without
/// absolute URLs. Unlike [`crate::integrations::utils::normalize_icons`],
/// it also allowed icons with purpose "maskable" which is supported on macOS,
/// and does not sort them.
fn filter_unsupported_icons(icons: &[IconResource]) -> Vec<&IconResource> {
    icons
        .iter()
        .filter(|icon| {
            (icon.purpose.contains(&ImagePurpose::Any)
                || icon.purpose.contains(&ImagePurpose::Maskable))
                && matches!(&icon.src, ManifestUrl::Absolute(_))
        })
        .collect()
}

/// Sort icons according to the target size.
///
/// Maskable icons are preferred over the normal ones. They are sorted by
/// their largest size. Icons larger than the target icon size are sorted
/// in the ascending order, and others are sorted in descending.
///
/// This is different from [`crate::integrations::utils::normalize_icons`],
/// which does not compare icons based on their purpose.
fn sort_icons_for_size(icons: &mut [&IconResource], size: &ImageSize) {
    // Compare sizes the same as in `crate::integrations::utils::normalize_icons`
    let compare_sizes = |icon1: &IconResource, icon2: &IconResource| {
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
    };

    // Compare icons by purpose, and by size if purposes are the same
    icons.sort_by(|icon1, icon2| {
        if icon1.purpose.contains(&ImagePurpose::Maskable)
            && icon2.purpose.contains(&ImagePurpose::Maskable)
        {
            compare_sizes(icon1, icon2)
        } else if icon1.purpose.contains(&ImagePurpose::Maskable) {
            Ordering::Less
        } else if icon2.purpose.contains(&ImagePurpose::Maskable) {
            Ordering::Greater
        } else {
            compare_sizes(icon1, icon2)
        }
    });
}

/// Obtain and process icons from the icon list.
///
/// For each size required by ICNS file, the best available icon
/// is downloaded and converted to a correct format. If icon cannot
/// be parsed, the next available icon is attempted. In case no
/// icons are available, an icon is generated from the web app name.
fn store_icons(target: &Path, name: &str, icons: &[IconResource], client: &Client) -> Result<()> {
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

    let mut iconset = IconFamily::new();

    let mut icons = filter_unsupported_icons(icons);
    let icons = icons.as_mut_slice();

    for size in &icon_sizes {
        let img_size = size.size();

        debug!("Looking for icon size {}", img_size);
        sort_icons_for_size(icons, &ImageSize::Fixed(img_size, img_size));

        for icon in &mut *icons {
            // Wrapped into a closure to emulate currently unstable `try` blocks
            let mut process = || -> Result<()> {
                let url: Url = icon.src.clone().try_into().context(CONVERT_ICON_URL_ERROR)?;
                debug!("Processing icon {}", url);

                // Download the image from the URL and load it as RGBA
                let (bytes, img_type) = download_icon(url, client).context(DOWNLOAD_ICON_ERROR)?;
                let mut img = load_icon(&bytes, &img_type, img_size).context(LOAD_ICON_ERROR)?;

                // Mask the image according to the Apple guidelines
                mask_icon(&mut img, icon.purpose.contains(&ImagePurpose::Maskable))
                    .context(MASK_ICON_ERROR)?;

                // Add the image to the icon set
                iconset.add_icon_with_type(
                    &Image::from_data(PixelFormat::RGBA, img_size, img_size, img.to_vec())?,
                    size.icon_type(),
                )?;

                debug!("Added size {}", img_size);
                Ok(())
            };

            // Process the icon and catch errors
            match process().context(PROCESS_ICON_ERROR) {
                Ok(_) => break,
                Err(error) => {
                    error!("{:?}", error);
                    warn!("Falling back to the next available icon");
                }
            }
        }
    }

    // If the web app does not provide any valid icons, generate them from the name
    if iconset.is_empty() {
        warn!("No compatible or working icon was found");
        warn!("Falling back to the generated icon from the name");
        let letter = name.chars().next().context(GET_LETTER_ERROR)?;

        for size in &icon_sizes {
            let image_size = ImageSize::Fixed(size.size(), size.size());
            let image_data = generate_icon(letter, &image_size).context(GENERATE_ICON_ERROR)?;

            let mut img = DynamicImage::ImageRgb8(image_data).into_rgba8();
            mask_icon(&mut img, true).context(MASK_ICON_ERROR)?;

            iconset.add_icon_with_type(
                &Image::from_data(PixelFormat::RGBA, size.size(), size.size(), img.to_vec())?,
                size.icon_type(),
            )?;
        }
    }

    // Store all icons into an icon set
    let iconset_file = File::create(target.join("app.icns")).context(CREATE_ICON_FILE_ERROR)?;
    let iconset_writer = BufWriter::new(iconset_file);
    iconset.write(iconset_writer).context(WRITE_APPLICATION_FILE_ERROR)?;
    Ok(())
}

/// Load icon and parse it as a RGBA image.
fn load_icon(content: &[u8], content_type: &str, size: u32) -> Result<RgbaImage> {
    if content_type == "image/svg+xml" {
        debug!("Processing as SVG icon");

        let mut options = usvg::Options::default();
        options.fontdb.load_system_fonts();

        let mut pixmap = tiny_skia::Pixmap::new(size, size).context("Invalid target size")?;
        let transform = tiny_skia::Transform::default();

        // Parse and render SVG icons using `usvg` and `resvg` crates
        let rtree = usvg::Tree::from_data(content, &options.to_ref())
            .context("Failed to parse SVG icon")?;
        resvg::render(&rtree, usvg::FitTo::Size(size, size), transform, pixmap.as_mut())
            .context("Failed to render SVG icon")?;
        return RgbaImage::from_raw(size, size, pixmap.take()).context("Failed to load SVG icon");
    }

    // Parse raster icons using the `image` crate and resize it to the correct size
    debug!("Processing as raster icon");
    let img = image::load_from_memory(content).context("Failed to load raster icon")?;
    let img = img.resize_to_fill(size, size, Gaussian).into_rgba8();
    Ok(img)
}

/// Apply the the correct icon shape specified by Apple for macOS.
///
/// Source:
/// - Guidelines: https://developer.apple.com/design/human-interface-guidelines/macos/icons-and-images/app-icon/
/// - Resources: https://developer.apple.com/design/resources/#macos-apps
///
fn mask_icon(icon: &mut RgbaImage, maskable: bool) -> Result<()> {
    debug!("Masking icon");

    let icon_size = Point { x: icon.width(), y: icon.height() };
    let mask = image::load_from_memory(include_bytes!("../../../assets/icon-mask-macos.png"))?;
    let shadow = image::load_from_memory(include_bytes!("../../../assets/icon-shadow-macos.png"))?;
    let scaled_mask = mask.resize(icon_size.x, icon_size.y, Gaussian); // This is really slow in debug builds, up to ~1s
    let scaled_shadow = shadow.resize(icon_size.x, icon_size.y, Gaussian); // This is really slow in debug builds, up to ~1s
    let mask_data = scaled_mask.into_rgba8();
    let shadow_data = scaled_shadow.into_rgba8();

    let scaled_icon_size = if maskable {
        icon_size
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

    let background = RgbaImage::from_pixel(icon_size.x, icon_size.y, Rgba([255, 255, 255, 255]));

    for pixel in background.enumerate_pixels() {
        let (pixel_x, pixel_y, original_pixel_value) = pixel;

        let mut pixel_value = original_pixel_value.to_owned();
        let icon_pixel_x = pixel_x as i32 - icon_offset.x as i32;
        let icon_pixel_y = pixel_y as i32 - icon_offset.y as i32;

        // Add icon into background
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

        // Apply mask to icon
        let mask_pixel = mask_data.get_pixel(pixel_x, pixel_y);
        pixel_value.0[3] = mask_pixel.0[0];

        // Add shadow to composed icon
        if pixel_value.0[3] == 0 {
            let shadow_pixel = shadow_data.get_pixel(pixel_x, pixel_y);
            pixel_value.0 = shadow_pixel.0;
        }

        // write pixel data to original icon
        icon.put_pixel(pixel_x, pixel_y, pixel_value);
    }

    Ok(())
}

/// Verify if the app bundle contains a web app.
fn verify_app_is_pwa(app_bundle: &Path, app_id: &str) -> Result<()> {
    let mut pkg_info = File::open(app_bundle.join("Contents/PkgInfo"))?;
    let mut pkg_info_content = String::new();
    pkg_info.read_to_string(&mut pkg_info_content)?;

    let pkg_info_id = format!("APPL{}", app_id);
    debug!("Verifying if a bundle is a web app");
    debug!("'{}' should be '{}'", pkg_info_content, pkg_info_id);

    if pkg_info_content != pkg_info_id {
        let bundle_name = app_bundle
            .file_name()
            .context(APP_BUNDLE_NAME_ERROR)?
            .to_str()
            .context(APP_BUNDLE_UNICODE_ERROR)?;

        bail!("{} is not a web app", bundle_name);
    }

    Ok(())
}

//////////////////////////////
// Implementation
//////////////////////////////

fn create_app_bundle(args: &IntegrationInstallArgs) -> Result<()> {
    let exe = args.dirs.executables.join("firefoxpwa").display().to_string();
    let ulid = args.site.ulid.to_string();
    let appid = format!("FFPWA-{ulid}");
    let bundleid = format!("si.filips.firefoxpwa.site.{ulid}");
    let name = args.site.name();

    // Process some known manifest categories and reformat them into Apple names
    // Apps can only have one category, so we will only use the first one
    let category = if let Some(category) = args.site.categories().first() {
        // Make category lower-case and remove all word separators for easier matching
        let category = normalize_category_name(category);

        // Get the mapped Apple category based on the web app categories
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

    let bundle = directory.join(format!("{}.app", sanitize_name(&name, &ulid)));
    let bundle_contents = bundle.join("Contents");
    let info_plist = bundle_contents.join("Info.plist");
    let pkg_info = bundle_contents.join("PkgInfo");
    let binary_dir = bundle_contents.join("MacOS");
    let resources_dir = bundle_contents.join("Resources");
    let loader = binary_dir.join("loader");

    // If the name has been changed, first rename the bundle directory
    if let Some(old_name) = &args.old_name {
        let old_bundle = directory.join(format!("{}.app", sanitize_name(old_name, &ulid)));
        let _ = rename(old_bundle, &bundle);
    }

    // Create the bundle directory
    create_dir_all(&bundle_contents).context(CREATE_APPLICATION_DIRECTORY_ERROR)?;
    create_dir_all(binary_dir).context(CREATE_APPLICATION_DIRECTORY_ERROR)?;
    create_dir_all(&resources_dir).context(CREATE_APPLICATION_DIRECTORY_ERROR)?;

    // Store the entry data
    let protocols = args
        .site
        .config
        .enabled_protocol_handlers
        .iter()
        .map(|protocol| {
            let mut handler = plist::dictionary::Dictionary::new();
            handler.insert("CFBundleURLName".into(), format!("{protocol} URL").into());
            handler.insert("CFBundleURLSchemes".into(), vec![protocol.clone().into()].into());
            handler.into()
        })
        .collect::<Vec<plist::Value>>();

    // FIXME: Protocol handlers do not work, they need to be fixed in the future

    let mut info_plist_dict = plist::dictionary::Dictionary::new();
    info_plist_dict.insert("CFBundlePackageType".into(), "APPL".into());
    info_plist_dict.insert("CFBundleIdentifier".into(), bundleid.into());
    info_plist_dict.insert("LSApplicationCategoryType".into(), category.into());
    info_plist_dict.insert("CFBundleName".into(), name.clone().into());
    info_plist_dict.insert("CFBundleVersion".into(), "1.0.0".into());
    info_plist_dict.insert("CFBundleShortVersionString".into(), "1.0.0".into());
    info_plist_dict.insert("CFBundleInfoDictionaryVersion".into(), "6.0".into());
    info_plist_dict.insert("CFBundleSignature".into(), appid.clone().into());
    info_plist_dict.insert("CFBundleDevelopmentRegion".into(), "en".into());
    info_plist_dict.insert("CFBundleExecutable".into(), "loader".into());
    info_plist_dict.insert("CFBundleIconFile".into(), "app.icns".into());
    info_plist_dict.insert("NSHighResolutionCapable".into(), true.into());
    info_plist_dict.insert("CFBundleURLTypes".into(), protocols.into());
    info_plist_dict.insert(
        "NSCameraUsageDescription".into(),
        "Only sites you allow within Firefox will be able to use the camera.".into(),
    );
    info_plist_dict.insert(
        "NSMicrophoneUsageDescription".into(),
        "Only sites you allow within Firefox will be able to use the microphone.".into(),
    );
    let info_plist_value: plist::Value = info_plist_dict.into();

    plist::to_file_xml(info_plist, &info_plist_value).context(WRITE_APPLICATION_FILE_ERROR)?;
    write(pkg_info, format!("APPL{}", appid)).context(WRITE_APPLICATION_FILE_ERROR)?;

    // Create and compile loader executable using Swift compiler
    // Swift compiler (swiftc) is part of Command Line Tools for Xcode which is required by Homebrew
    // We can assume users will have it installed, but provide old script-based fallback just in case
    if Command::new("xcode-select").stdout(Stdio::null()).arg("-p").status().is_ok() {
        let loader_source_content = format!(
            r#"import Foundation
let task = Process()
task.launchPath = "{exe}"
task.arguments = ["site", "launch", "--direct-launch", "{ulid}"] + CommandLine.arguments[1...]
task.launch()
task.waitUntilExit()
"#
        );

        let mut loader_source_file = tempfile::Builder::new()
            .prefix("firefoxpwa-loader-")
            .suffix(".swift")
            .tempfile()
            .context(CREATE_TEMP_FILE_ERROR)?;

        loader_source_file
            .as_file_mut()
            .write_all(loader_source_content.as_bytes())
            .context("Failed to write loader source")?;

        Command::new("swiftc")
            .arg("-O")
            .arg("-o")
            .arg(loader)
            .arg(loader_source_file.path().as_os_str())
            .status()
            .context("Failed to compile loader source")?;
    } else {
        warn!("Could not find Command Line Tools for Xcode");
        warn!("Falling back to the legacy script-based loader");
        warn!("Tools can be installed using: xcode-select --install");
        warn!("After installing, update your web app to apply changes");

        #[rustfmt::skip]
        let loader_content = format!("#!/usr/bin/env sh\n\n{exe} site launch --direct-launch {ulid} \"$@\"\n");
        let mut loader_file = File::create(loader).context(WRITE_APPLICATION_FILE_ERROR)?;
        let loader_permissions = Permissions::from_mode(0o755);
        loader_file.set_permissions(loader_permissions).context(WRITE_APPLICATION_FILE_ERROR)?;
        loader_file.write_all(loader_content.as_ref()).context(WRITE_APPLICATION_FILE_ERROR)?;
    }

    // Update icons if needed
    if args.update_icons {
        store_icons(&resources_dir, &name, &args.site.manifest.icons, args.client.unwrap())
            .context(STORE_ICONS_ERROR)?;
    }

    // Our app bundle is not signed with an Apple developer certificate
    // By removing the quarantine attribute we can skip the signature verification
    Command::new("xattr")
        .args(["-rd", "com.apple.quarantine", bundle.to_str().unwrap()])
        .output()?;

    Ok(())
}

fn remove_app_bundle(args: &IntegrationUninstallArgs) -> Result<()> {
    let ulid = args.site.ulid.to_string();

    let bundle = directories::BaseDirs::new()
        .context(BASE_DIRECTORIES_ERROR)?
        .home_dir()
        .join("Applications")
        .join(format!("{}.app", sanitize_name(&args.site.name(), &ulid)));

    verify_app_is_pwa(&bundle, &format!("FFPWA-{ulid}"))?;
    let _ = remove_dir_all(bundle);

    Ok(())
}

//////////////////////////////
// Interface
//////////////////////////////

#[inline]
pub fn install(args: &IntegrationInstallArgs) -> Result<()> {
    create_app_bundle(args).context("Failed to create application bundle")?;
    Ok(())
}

#[inline]
pub fn uninstall(args: &IntegrationUninstallArgs) -> Result<()> {
    remove_app_bundle(args).context("Failed to remove application bundle")?;
    Ok(())
}

#[inline]
pub fn launch(site: &Site, url: &Option<Url>, arguments: &[String]) -> Result<Child> {
    let name = site.name();

    let app_path = directories::BaseDirs::new()
        .context(BASE_DIRECTORIES_ERROR)?
        .home_dir()
        .join(format!("Applications/{}.app", name));

    debug!("Verifying that {} is a PWA app bundle", app_path.to_str().unwrap());
    match app_path.exists() {
        true => verify_app_is_pwa(&app_path, &format!("FFPWA-{}", site.ulid))?,
        false => bail!("Application bundle does not exist"),
    }

    let mut args = vec![app_path.display().to_string()];

    // We need to append `--args` when we provide additional arguments to the PWA
    if url.is_some() || !arguments.is_empty() {
        args.extend_from_slice(&["--args".into()]);
    }

    // Support launching PWA with custom URLs
    if let Some(url) = url {
        args.extend_from_slice(&["--url".into(), url.to_string()]);
    }

    // Support launching PWA with custom Firefox arguments
    if !arguments.is_empty() {
        args.extend_from_slice(&["--".into()]);
        args.extend_from_slice(arguments);
    }

    debug!("Launching PWA app bundle");
    let mut command = Command::new("open");
    command.args(&args).spawn().context(LAUNCH_APPLICATION_BUNDLE)
}
