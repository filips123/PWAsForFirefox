use std::convert::TryInto;
use std::fmt::Write as FmtWrite;
use std::fs::{File, copy, create_dir_all, remove_file, write};
use std::io::Write as IoWrite;
use std::path::Path;
use std::process::Command;

use anyhow::{Context, Result};
use glob::glob;
use image::GenericImageView;
use log::{debug, error, warn};
use reqwest::blocking::Client;
use url::Url;
use web_app_manifest::resources::IconResource;
use web_app_manifest::types::{ImagePurpose, ImageSize};

use crate::components::site::Site;
use crate::integrations::categories::XDG_CATEGORIES;
use crate::integrations::utils::{download_icon, normalize_category_name, store_icon};
use crate::integrations::{IntegrationInstallArgs, IntegrationUninstallArgs};
use crate::utils::sanitize_string;

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
const COPY_STARTUP_ENTRY_ERROR: &str = "Failed to copy startup entry";

//////////////////////////////
// Utils
//////////////////////////////

/// Update system's application cache.
#[rustfmt::skip]
fn update_application_cache(data: &Path) {
    let _ = Command::new("touch").arg(data.join("icons")).arg(data.join("icons/hicolor")).spawn();
    let _ = Command::new("update-desktop-database").arg(data.join("applications")).spawn();
    let _ = Command::new("update-mime-database").arg(data.join("mime")).spawn();
    let _ = Command::new("gtk-update-icon-cache").spawn();
    let _ = Command::new("xdg-desktop-menu").arg("forceupdate").spawn();
}

//////////////////////////////
// Implementation
//////////////////////////////

#[derive(Debug, Clone)]
struct SiteIds {
    pub name: String,
    pub description: String,
    pub ulid: String,
    pub classid: String,
}

impl SiteIds {
    pub fn create_for(site: &Site) -> Self {
        let name = site.name();
        let description = site.description();
        let ulid = site.ulid.to_string();
        let classid = format!("FFPWA-{ulid}");
        Self { name, description, ulid, classid }
    }
}

/// Obtain and process icons from the icon list.
///
/// All supported icons from the icon list are downloaded and stored to
/// the correct locations to comply with the Icon Theme Specification.
///
/// All SVG icons are directly stored as `scalable` or `symbolic` icons,
/// and other supported icons are converted to PNG and then stored.
///
/// The 48x48 icon has to exist as required by the Icon Theme Specification.
/// In case it is not provided by the icon list, it is obtained using
/// the [`store_icon`] function.
///
/// # Parameters
///
/// - `id`:    An icon ID, consisting from the web app ID and shortcut ID.
/// - `name`:  A web app or shortcut name. Used to generate a fallback icon.
/// - `icons`: A list of available icons for the web app or shortcut.
/// - `data`:  A path to the XDG data directory.
/// - `client`: An instance of a blocking HTTP client.
///
fn store_icons(
    id: &str,
    name: &str,
    icons: &[IconResource],
    data: &Path,
    client: &Client,
) -> Result<()> {
    // The 48x48 icon has to exist as required by the Icon Theme Specification
    // We need to generate it manually if the manifest does not provide it
    let mut required_icon_found = false;

    // Download and store all icons
    for icon in icons {
        // Wrapped into a closure to emulate currently unstable `try` blocks
        let mut process = || -> Result<()> {
            // Only icons with absolute URLs can be used
            let url: Url = icon.src.clone().try_into().context(CONVERT_ICON_URL_ERROR)?;
            debug!("Processing icon {url}");

            // Download icon and get its content type
            let (content, content_type) =
                download_icon(url, client).context(DOWNLOAD_ICON_ERROR)?;

            if content_type == "image/svg+xml" {
                // Scalable (normal SVG) icons can be directly saved into the correct directory
                if icon.purpose.contains(&ImagePurpose::Any) {
                    let directory = data.join("icons/hicolor/scalable/apps");
                    let filename = directory.join(format!("{id}.svg"));

                    debug!("Saving as scalable icon");
                    create_dir_all(directory).context(CREATE_ICON_DIRECTORY_ERROR)?;
                    let mut file = File::create(filename).context(CREATE_ICON_FILE_ERROR)?;
                    file.write_all(&content).context(SAVE_ICON_ERROR)?;
                }

                // Symbolic (monochrome SVG) icons can be directly saved into the correct directory
                if icon.purpose.contains(&ImagePurpose::Monochrome) {
                    let directory = data.join("icons/hicolor/symbolic/apps");
                    let filename = directory.join(format!("{id}-symbolic.svg"));

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
            let filename = directory.join(format!("{id}.png"));
            create_dir_all(directory).context(CREATE_ICON_DIRECTORY_ERROR)?;
            img.save(filename).context(SAVE_ICON_ERROR)?;

            if size == (48, 48) {
                required_icon_found = true;
            }

            Ok(())
        };

        // Process the icon and catch errors
        if let Err(error) = process().context(PROCESS_ICON_ERROR) {
            error!("{error:?}");
            warn!("Falling back to the next available icon");
        }
    }

    // We need to create 48x48 icon to comply with the specification
    // Use the first working icon from the normalized list
    if !required_icon_found {
        // Create directory for 48x48 icons in case it does not exist
        let directory = data.join("icons/hicolor/48x48/apps");
        let filename = directory.join(format!("{id}.png"));
        create_dir_all(directory).context(CREATE_ICON_DIRECTORY_ERROR)?;

        warn!("No required 48x48 icon is provided");
        warn!("Generating it from other available icons");
        let size = &ImageSize::Fixed(48, 48);
        return store_icon(icons, name, size, &filename, client);
    }

    Ok(())
}

fn remove_icons(classid: &str, data: &Path) {
    let directory = data.display().to_string();
    let pattern = format!("{directory}/icons/hicolor/*/apps/{classid}*");

    if let Ok(paths) = glob(&pattern) {
        for path in paths.filter_map(Result::ok) {
            let _ = remove_file(path);
        }
    }
}

fn create_desktop_entry(
    args: &IntegrationInstallArgs,
    ids: &SiteIds,
    exe: &str,
    data: &Path,
) -> Result<()> {
    // Process some known manifest categories and reformat them into XDG names
    let mut categories = vec![];
    for category in args.site.categories() {
        // Normalize category name for easier matching
        let category = normalize_category_name(&category);

        // Get the mapped XDG category based on the site categories
        if let Some(category) = XDG_CATEGORIES.get(&category) {
            categories.extend_from_slice(category);
        }
    }
    categories.sort_unstable();
    categories.dedup();

    // Get the .desktop filename in the applications directory
    let directory = data.join("applications");
    let filename = directory.join(format!("{}.desktop", ids.classid));

    // Store entry data
    let mut entry = format!(
        "[Desktop Entry]
Type=Application
Version=1.4
Name={name}
Comment={description}
Keywords={keywords};
Categories=GTK;{categories};
Icon={icon}
Exec={exe} site launch {id} --protocol %u
Actions={actions}
MimeType={protocols}
Terminal=false
StartupNotify=true
StartupWMClass={wmclass}
",
        id = &ids.ulid,
        name = &ids.name,
        description = &ids.description,
        keywords = &args.site.keywords().join(";"),
        categories = &categories.join(";"),
        actions = (0..args.site.manifest.shortcuts.len()).fold(String::new(), |mut output, i| {
            let _ = write!(output, "{i};");
            output
        }),
        protocols = args.site.config.enabled_protocol_handlers.iter().fold(
            String::new(),
            |mut output, protocol| {
                let _ = write!(output, "x-scheme-handler/{};", sanitize_string(protocol));
                output
            }
        ),
        icon = &ids.classid,
        wmclass = &ids.classid,
        exe = &exe,
    );

    // Store all shortcuts
    for (i, shortcut) in args.site.manifest.shortcuts.iter().enumerate() {
        let name = sanitize_string(&shortcut.name);
        let url: Url = shortcut.url.clone().try_into().context(CONVERT_SHORTCUT_URL_ERROR)?;
        let icon = format!("{}-{}", ids.classid, i);

        if args.update_icons {
            store_icons(&icon, &name, &shortcut.icons, data, args.client.unwrap())
                .context("Failed to store shortcut icons")?;
        }

        let action = format!(
            "
[Desktop Action {actionid}]
Name={name}
Icon={icon}
Exec={exe} site launch {siteid} --url \"{url}\"
",
            actionid = i,
            siteid = &ids.ulid,
            name = &name,
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

fn create_startup_entry(
    args: &IntegrationInstallArgs,
    ids: &SiteIds,
    data: &Path,
    config: &Path,
) -> Result<()> {
    let applications_entry = data.join("applications").join(format!("{}.desktop", ids.classid));
    let autostart_entry = config.join("autostart").join(format!("{}.desktop", ids.classid));

    if args.site.config.launch_on_login {
        // If launch on login is enabled, copy its shortcut to the autostart directory
        copy(applications_entry, autostart_entry).context(COPY_STARTUP_ENTRY_ERROR)?;
    } else {
        // Otherwise, try to remove its shortcut from the autostart directory
        let _ = remove_file(autostart_entry);
    }

    Ok(())
}

fn remove_desktop_entry(classid: &str, data: &Path) {
    let directory = data.join("applications");
    let filename = directory.join(format!("{classid}.desktop"));
    let _ = remove_file(filename);
}

fn remove_startup_entry(classid: &str, config: &Path) {
    let directory = config.join("autostart");
    let filename = directory.join(format!("{classid}.desktop"));
    let _ = remove_file(filename);
}

//////////////////////////////
// Interface
//////////////////////////////

#[inline]
pub fn install(args: &IntegrationInstallArgs) -> Result<()> {
    let ids = SiteIds::create_for(args.site);
    let exe = args.dirs.executables.join("firefoxpwa").display().to_string();

    let base = directories::BaseDirs::new().context(BASE_DIRECTORIES_ERROR)?;
    let data = base.data_dir().to_owned();
    let config = base.config_dir().to_owned();

    if args.update_icons {
        store_icons(&ids.classid, &ids.name, &args.site.icons(), &data, args.client.unwrap())
            .context("Failed to store web app icons")?;
    }

    create_desktop_entry(args, &ids, &exe, &data).context("Failed to create application entry")?;
    create_startup_entry(args, &ids, &data, &config).context("Failed to create startup entry")?;
    update_application_cache(&data);

    Ok(())
}

#[inline]
pub fn uninstall(args: &IntegrationUninstallArgs) -> Result<()> {
    let ids = SiteIds::create_for(args.site);

    let base = directories::BaseDirs::new().context(BASE_DIRECTORIES_ERROR)?;
    let data = &base.data_dir().to_owned();
    let config = &base.config_dir().to_owned();

    remove_icons(&ids.classid, data);
    remove_desktop_entry(&ids.classid, data);
    remove_startup_entry(&ids.classid, config);
    update_application_cache(data);

    Ok(())
}
