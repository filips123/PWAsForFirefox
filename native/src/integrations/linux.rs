use std::convert::TryInto;
use std::fs::{create_dir_all, remove_file, write, File};
use std::path::Path;
use std::process::Command;

use anyhow::{Context, Result};
use data_url::DataUrl;
use glob::glob;
use image::imageops::FilterType::Gaussian;
use log::error;
use url::Url;
use web_app_manifest::resources::IconResource;
use web_app_manifest::types::{ImagePurpose, ImageSize};

use crate::directories::ProjectDirs;
use crate::integrations::xdg::XDG_CATEGORIES;
use crate::integrations::{generate_icon, is_icon_supported, SiteInfoInstall, SiteInfoUninstall};

const BASE_DIRECTORIES_ERROR: &str = "Failed to determine base system directories";
const CONVERT_ICON_URL_ERROR: &str = "Failed to convert icon URL";
const DATA_URL_PROCESS_ERROR: &str = "Failed to process icon data URL";
const DATA_URL_DECODE_ERROR: &str = "Failed to decode icon data URL";
const DOWNLOAD_ICON_ERROR: &str = "Failed to download icon";
const READ_ICON_ERROR: &str = "Failed to read icon";
const LOAD_ICON_ERROR: &str = "Failed to load icon";
const SAVE_ICON_ERROR: &str = "Failed to save icon";
const GENERATE_ICON_ERROR: &str = "Failed to generate icon";
const GET_LETTER_ERROR: &str = "Failed to get first letter";
const CREATE_ICON_DIRECTORY_ERROR: &str = "Failed to create icon directory";
const CREATE_ICON_FILE_ERROR: &str = "Failed to create icon file";
const CREATE_APPLICATION_DIRECTORY_ERROR: &str = "Failed to create application directory";
const WRITE_APPLICATION_FILE_ERROR: &str = "Failed to write application file";

fn store_icons(id: &str, name: &str, icons: &[IconResource], suffix: &str) -> Result<()> {
    // The 48x48 icon always has to exist
    // We need to generate it manually if the manifest does not provide it
    let mut required_icon_found = false;

    // App ID is based on ste site ID
    let appid = format!("FFPWA-{}", &id);

    // Download and store all icons
    for icon in icons {
        // Skip data URLs because supporting them would make code a lot more complicated
        // The 48x48 icon is added later in any case because no "required icon" is found
        let url: Url = icon.src.clone().try_into().context(CONVERT_ICON_URL_ERROR)?;
        if url.scheme() == "data" {
            continue;
        };

        // Download the image from the URL
        let mut response = reqwest::blocking::get(url).context(DOWNLOAD_ICON_ERROR)?;

        if let Some(content_type) = response.headers().get(reqwest::header::CONTENT_TYPE) {
            if content_type == "image/svg+xml" {
                // Scalable (SVG) icons can be directly put into the correct directory
                if icon.purpose.contains(&ImagePurpose::Any) {
                    let directory = directories::BaseDirs::new()
                        .context(BASE_DIRECTORIES_ERROR)?
                        .data_dir()
                        .join("icons/hicolor/scalable/apps");
                    let filename = directory.join(format!("{}{}.svg", appid, suffix));

                    create_dir_all(directory).context(CREATE_ICON_DIRECTORY_ERROR)?;
                    let mut file = File::create(filename).context(CREATE_ICON_FILE_ERROR)?;
                    response.copy_to(&mut file).context(SAVE_ICON_ERROR)?;
                }

                // Symbolic (monochrome SVG) icons can be directly put into the correct directory
                if icon.purpose.contains(&ImagePurpose::Monochrome) {
                    let directory = directories::BaseDirs::new()
                        .context(BASE_DIRECTORIES_ERROR)?
                        .data_dir()
                        .join("icons/hicolor/symbolic/apps");
                    let filename = directory.join(format!("{}{}-symbolic.svg", appid, suffix));

                    create_dir_all(directory).context(CREATE_ICON_DIRECTORY_ERROR)?;
                    let mut file = File::create(filename).context(CREATE_ICON_FILE_ERROR)?;
                    response.copy_to(&mut file).context(SAVE_ICON_ERROR)?;
                }

                continue;
            }
        }

        // Other icons can only be "any" type
        if !icon.purpose.contains(&ImagePurpose::Any) {
            continue;
        }

        // Other icons need to be processed (converted to PNG)
        if let Some(size) = icon.sizes.iter().max() {
            if size == &ImageSize::Fixed(48, 48) {
                required_icon_found = true;
            }

            let bytes = &response.bytes().context(READ_ICON_ERROR)?;
            let img = image::load_from_memory(bytes).context(LOAD_ICON_ERROR)?;

            let directory = directories::BaseDirs::new()
                .context(BASE_DIRECTORIES_ERROR)?
                .data_dir()
                .join(format!("icons/hicolor/{}/apps", size.to_string()));
            let filename = directory.join(format!("{}{}.png", appid, suffix));

            create_dir_all(directory).context(CREATE_ICON_DIRECTORY_ERROR)?;
            img.save(&filename).context(SAVE_ICON_ERROR)?;
        }
    }

    if !required_icon_found {
        // We need to create 48x48 icon for better compatibility
        let icon = icons
            .iter()
            .find(|icon| {
                icon.sizes.iter().max() >= Some(&ImageSize::Fixed(48, 48))
                    && is_icon_supported(icon)
            })
            .or_else(|| icons.iter().rev().find(|icon| is_icon_supported(icon)));

        let directory = directories::BaseDirs::new()
            .context(BASE_DIRECTORIES_ERROR)?
            .data_dir()
            .join("icons/hicolor/48x48/apps");
        let filename = directory.join(format!("{}{}.png", appid, suffix));

        if let Some(icon) = icon {
            // Download the image from the URL
            // Either download it from the network using request or decode it from a data URL
            let url: Url = icon.src.clone().try_into().context(CONVERT_ICON_URL_ERROR)?;
            let bytes = if url.scheme() != "data" {
                let response = reqwest::blocking::get(url).context(DOWNLOAD_ICON_ERROR)?;
                response.bytes().context(READ_ICON_ERROR)?
            } else {
                let url = DataUrl::process(url.as_str()).context(DATA_URL_PROCESS_ERROR)?;
                let (body, _) = url.decode_to_vec().context(DATA_URL_DECODE_ERROR)?;
                body.into()
            };
            let mut img = image::load_from_memory(&bytes).context(LOAD_ICON_ERROR)?;
            let img = img.resize(48, 48, Gaussian);

            create_dir_all(directory).context(CREATE_ICON_DIRECTORY_ERROR)?;
            img.save(&filename).context(SAVE_ICON_ERROR)?;
        } else {
            // Generate icon from the first letter of the site/shortcut name
            let letter = name.chars().next().context(GET_LETTER_ERROR)?;
            create_dir_all(directory).context(CREATE_ICON_DIRECTORY_ERROR)?;
            generate_icon(letter, 256, &filename).context(GENERATE_ICON_ERROR)?;
        }
    }

    Ok(())
}

fn create_application_entry(info: &SiteInfoInstall, exe: &str) -> Result<()> {
    // App ID is based on ste site ID
    let appid = format!("FFPWA-{}", &info.id);

    // Process some known manifest categories and reformat them into XDG names
    let mut categories = vec![];
    for category in info.categories {
        // Make category lower-case and remove all word separators for easier matching
        let category = category.to_lowercase().replace("-", "").replace("_", "").replace(" ", "");

        // Get the mapped XDG category based on the site categories
        if let Some(category) = XDG_CATEGORIES.get(&category) {
            categories.extend_from_slice(category);
        }
    }
    categories.sort_unstable();
    categories.dedup();

    // Get the .desktop filename in the applications directory
    let directory = directories::BaseDirs::new()
        .context(BASE_DIRECTORIES_ERROR)?
        .data_dir()
        .join("applications");
    let filename = directory.join(format!("{}.desktop", appid));

    // Store entry data
    let mut entry = format!(
        "[Desktop Entry]
Type=Application
Version=1.4
Name={name}
Comment={description}
Keywords={keywords};
Categories=GTK;WebApps;{categories};
Icon={icon}
Exec={exe} site launch {id}
Actions={actions}
Terminal=false
StartupNotify=true
StartupWMClass={wmclass}
",
        id = &info.id,
        name = &info.name,
        description = &info.description,
        keywords = &info.keywords.join(";"),
        categories = &categories.join(";"),
        actions = (0..info.shortcuts.len()).map(|i| i.to_string() + ";").collect::<String>(),
        icon = &appid,
        wmclass = &appid,
        exe = &exe,
    );

    // Store all shortcuts
    for (i, shortcut) in info.shortcuts.iter().enumerate() {
        store_icons(&info.id, &shortcut.name, &shortcut.icons, &format!("-{}", i))
            .context("Failed to process and store shortcut icons")
            .unwrap_or_else(|error| {
                // Shortcut icon is not important so much, so we can just log errors
                error!("{:?}", error);
            });
        let url: Url = shortcut.url.clone().try_into().context("Failed to convert shortcut URL")?;

        let action = format!(
            "
[Desktop Action {actionid}]
Name={name}
Icon={icon}
Exec={exe} site launch {siteid} --url \"{url}\"
",
            actionid = i,
            siteid = &info.id,
            name = &shortcut.name,
            url = &url,
            icon = format!("{}-{}", appid, i),
            exe = &exe,
        );

        entry += &action;
    }

    // Create the directory and write the file
    create_dir_all(directory).context(CREATE_APPLICATION_DIRECTORY_ERROR)?;
    write(filename, entry).context(WRITE_APPLICATION_FILE_ERROR)?;

    Ok(())
}

#[rustfmt::skip]
fn update_application_cache() -> Result<()> {
    let data = directories::BaseDirs::new().context(BASE_DIRECTORIES_ERROR)?.data_dir().to_owned();

    Command::new("touch").arg(data.join("icons")).arg(data.join("icons/hicolor")).spawn()?;
    Command::new("gtk-update-icon-cache").spawn()?;

    Ok(())
}

#[inline]
pub fn install(info: &SiteInfoInstall, dirs: &ProjectDirs) -> Result<()> {
    let exe = dirs.executables.join("firefoxpwa").display().to_string();

    store_icons(&info.id, &info.name, info.icons, "")
        .context("Failed to process and store site icons")?;
    create_application_entry(info, &exe).context("Failed to create application entry")?;
    let _ = update_application_cache();

    Ok(())
}

fn remove_icons(info: &SiteInfoUninstall) -> Result<()> {
    let directory = directories::BaseDirs::new()
        .context(BASE_DIRECTORIES_ERROR)?
        .data_dir()
        .display()
        .to_string();
    let pattern = format!("{}/icons/hicolor/*/apps/FFPWA-{}*", directory, info.id);

    for path in glob(&pattern)?.filter_map(Result::ok) {
        let _ = remove_file(path);
    }

    Ok(())
}

fn remove_application_entry(info: &SiteInfoUninstall) -> Result<()> {
    let directory = directories::BaseDirs::new()
        .context(BASE_DIRECTORIES_ERROR)?
        .data_dir()
        .join("applications");
    let filename = directory.join(format!("FFPWA-{}.desktop", info.id));

    let _ = remove_file(filename);
    Ok(())
}

#[inline]
pub fn uninstall(info: &SiteInfoUninstall) -> Result<()> {
    remove_icons(info).context("Failed to remove site icons")?;
    remove_application_entry(info).context("Failed to remove application entry")?;

    Ok(())
}
