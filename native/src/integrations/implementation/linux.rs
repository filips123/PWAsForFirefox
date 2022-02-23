use std::convert::TryInto;
use std::fs::{create_dir_all, remove_file, write, File};
use std::io::Write;
use std::path::Path;
use std::process::Command;

use anyhow::{Context, Result};
use glob::glob;
use image::GenericImageView;
use log::{debug, error, warn};
use url::Url;
use web_app_manifest::resources::IconResource;
use web_app_manifest::types::{ImagePurpose, ImageSize};

use crate::directories::ProjectDirs;
use crate::integrations::categories::XDG_CATEGORIES;
use crate::integrations::utils::{download_icon, process_icons};
use crate::integrations::{SiteInfoInstall, SiteInfoUninstall};

const BASE_DIRECTORIES_ERROR: &str = "Failed to determine base system directories";
const CONVERT_ICON_URL_ERROR: &str = "Failed to convert icon URL";
const CONVERT_SHORTCUT_URL_ERROR: &str = "Failed to convert shortcut URL";
const DOWNLOAD_ICON_ERROR: &str = "Failed to download icon";
const PROCESS_ICON_ERROR: &str = "Failed to process icon";
const LOAD_ICON_ERROR: &str = "Failed to load icon";
const SAVE_ICON_ERROR: &str = "Failed to save icon";
const CREATE_ICON_DIRECTORY_ERROR: &str = "Failed to create icon directory";
const CREATE_ICON_FILE_ERROR: &str = "Failed to create icon file";
const CREATE_APPLICATION_DIRECTORY_ERROR: &str = "Failed to create application directory";
const WRITE_APPLICATION_FILE_ERROR: &str = "Failed to write application file";

//////////////////////////////
// Utils
//////////////////////////////

/// Normalize category name.
///
/// Category name is converted to lower-case and all word separators (`-`, `_`, ` `)
/// are removed. This allows easier matching with keys from the categories map.
#[inline]
fn normalize_category_name(category: &str) -> String {
    category.to_lowercase().replace("-", "").replace("_", "").replace(" ", "")
}

/// Update system's icon cache.
#[rustfmt::skip]
fn update_application_cache(data: &Path) -> Result<()> {
    Command::new("touch").arg(data.join("icons")).arg(data.join("icons/hicolor")).spawn()?;
    Command::new("gtk-update-icon-cache").spawn()?;
    Ok(())
}

//////////////////////////////
// Implementation
//////////////////////////////

/// Obtain and process icons from the icon list.
///
/// All supported icons from the icon list are downloaded and stored to
/// the correct locations the comply with the Icon Theme Specification.
///
/// All SVG icons are directly stored as `scalable` or `symbolic` icons,
/// and other supported icons are converted to PNG and then stored.
///
/// The 48x48 icon has to exist as required by the Icon Theme Specification.
/// In case it is not provided by the icon list, is is obtained using
/// the [`process_icons`] function.
///
/// # Parameters
///
/// - `id`:    An icon ID, consisting from the web app ID and shortcut ID.
/// - `name`:  A web app or shortcut name. Used to generate a fallback icon.
/// - `icons`: A list of available icons for the web app or shortcut.
/// - `data`:  A path to the XDG data directory.
///
fn store_icons(id: &str, name: &str, icons: &[IconResource], data: &Path) -> Result<()> {
    // The 48x48 icon has to exist as required by the Icon Theme Specification
    // We need to generate it manually if the manifest does not provide it
    let mut required_icon_found = false;

    // Download and store all icons
    for icon in icons {
        // Wrapped into a closure to emulate currently unstable `try` blocks
        let mut process = || -> Result<()> {
            // Only icons with absolute URLs can be used
            let url: Url = icon.src.clone().try_into().context(CONVERT_ICON_URL_ERROR)?;
            debug!("Processing icon {}", url);

            // Download icon and get its content type
            let (content, content_type) = download_icon(url).context(DOWNLOAD_ICON_ERROR)?;

            if content_type == "image/svg+xml" {
                // Scalable (normal SVG) icons can be directly saved into the correct directory
                if icon.purpose.contains(&ImagePurpose::Any) {
                    let directory = data.join("icons/hicolor/scalable/apps");
                    let filename = directory.join(format!("{}.svg", id));

                    debug!("Saving as scalable icon");
                    create_dir_all(directory).context(CREATE_ICON_DIRECTORY_ERROR)?;
                    let mut file = File::create(filename).context(CREATE_ICON_FILE_ERROR)?;
                    file.write_all(&content).context(SAVE_ICON_ERROR)?;
                }

                // Symbolic (monochrome SVG) icons can be directly saved into the correct directory
                if icon.purpose.contains(&ImagePurpose::Monochrome) {
                    let directory = data.join("icons/hicolor/symbolic/apps");
                    let filename = directory.join(format!("{}-symbolic.svg", id));

                    debug!("Saving as symbolic icon");
                    create_dir_all(directory).context(CREATE_ICON_DIRECTORY_ERROR)?;
                    let mut file = File::create(filename).context(CREATE_ICON_FILE_ERROR)?;
                    file.write_all(&content).context(SAVE_ICON_ERROR)?;
                }

                return Ok(());
            }

            // Raster icons must contain "any" type
            // Symbolic raster icons are not supported by DEs
            if !icon.purpose.contains(&ImagePurpose::Any) {
                return Ok(());
            }

            // Raster icons need to be processed (converted to PNG) using the `image` crate
            debug!("Processing as raster icon");
            let img = image::load_from_memory(&content).context(LOAD_ICON_ERROR)?;
            let size = img.dimensions();

            let directory = data.join(format!("icons/hicolor/{}x{}/apps", size.0, size.1));
            let filename = directory.join(format!("{}.png", id));
            create_dir_all(directory).context(CREATE_ICON_DIRECTORY_ERROR)?;
            img.save(&filename).context(SAVE_ICON_ERROR)?;

            if size == (48, 48) {
                required_icon_found = true;
            }

            Ok(())
        };

        // Process the icon and catch errors
        if let Err(error) = process().context(PROCESS_ICON_ERROR) {
            error!("{:?}", error);
            warn!("Falling back to the next available icon");
        }
    }

    // We need to create 48x48 icon to comply with the specification
    // Use the first working icon from the normalized list
    if !required_icon_found {
        // Create directory for 48x48 icons in case it does not exist
        let directory = data.join("icons/hicolor/48x48/apps");
        let filename = directory.join(format!("{}.png", id));
        create_dir_all(directory).context(CREATE_ICON_DIRECTORY_ERROR)?;

        warn!("No required 48x48 icon is provided");
        warn!("Generating it from other available icons");
        let size = &ImageSize::Fixed(48, 48);
        return process_icons(icons, name, size, &filename);
    }

    Ok(())
}

fn remove_icons(info: &SiteInfoUninstall, data: &Path) -> Result<()> {
    let directory = data.display().to_string();
    let pattern = format!("{}/icons/hicolor/*/apps/FFPWA-{}*", directory, info.id);

    for path in glob(&pattern)?.filter_map(Result::ok) {
        let _ = remove_file(path);
    }

    Ok(())
}

fn create_desktop_entry(appid: &str, info: &SiteInfoInstall, exe: &str, data: &Path) -> Result<()> {
    // Process some known manifest categories and reformat them into XDG names
    let mut categories = vec![];
    for category in info.categories {
        // Normalize category name for eacher matching
        let category = normalize_category_name(category);

        // Get the mapped XDG category based on the site categories
        if let Some(category) = XDG_CATEGORIES.get(&category) {
            categories.extend_from_slice(category);
        }
    }
    categories.sort_unstable();
    categories.dedup();

    // Get the .desktop filename in the applications directory
    let directory = data.join("applications");
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
        let url: Url = shortcut.url.clone().try_into().context(CONVERT_SHORTCUT_URL_ERROR)?;
        let icon = format!("{}-{}", appid, i);

        store_icons(&icon, &shortcut.name, &shortcut.icons, data)
            .context("Failed to store shortcut icons")?;

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
            icon = &icon,
            url = &url,
            exe = &exe,
        );

        entry += &action;
    }

    // Create the directory and write the file
    create_dir_all(directory).context(CREATE_APPLICATION_DIRECTORY_ERROR)?;
    write(filename, entry).context(WRITE_APPLICATION_FILE_ERROR)?;

    Ok(())
}

fn remove_desktop_entry(info: &SiteInfoUninstall, data: &Path) -> Result<()> {
    let directory = data.join("applications");
    let filename = directory.join(format!("FFPWA-{}.desktop", info.id));

    let _ = remove_file(filename);
    Ok(())
}

//////////////////////////////
// Interface
//////////////////////////////

#[inline]
pub fn install(info: &SiteInfoInstall, dirs: &ProjectDirs) -> Result<()> {
    let appid = &format!("FFPWA-{}", &info.id);

    let data = directories::BaseDirs::new().context(BASE_DIRECTORIES_ERROR)?.data_dir().to_owned();
    let exe = dirs.executables.join("firefoxpwa").display().to_string();

    store_icons(appid, &info.name, info.icons, &data).context("Failed to store web app icons")?;
    create_desktop_entry(appid, info, &exe, &data).context("Failed to create application entry")?;
    let _ = update_application_cache(&data);

    Ok(())
}

#[inline]
pub fn uninstall(info: &SiteInfoUninstall, _dirs: &ProjectDirs) -> Result<()> {
    let data = &directories::BaseDirs::new().context(BASE_DIRECTORIES_ERROR)?.data_dir().to_owned();

    remove_icons(info, data).context("Failed to remove web app icons")?;
    remove_desktop_entry(info, data).context("Failed to remove application entry")?;
    let _ = update_application_cache(data);

    Ok(())
}
