use std::ffi::OsStr;
use std::fs::{create_dir_all, remove_dir_all, File};
use std::io::Write;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use configparser::ini::Ini;
use log::warn;
use web_app_manifest::types::ImageSize;

use crate::integrations::categories::PORTABLEAPPS_CATEGORIES;
use crate::integrations::utils::{normalize_category_name, process_icons};
use crate::integrations::{IntegrationInstallArgs, IntegrationUninstallArgs};

#[derive(Debug, Clone, Copy)]
struct PortableAppIcon {
    size: u32,
    format: &'static str,
}

impl PortableAppIcon {
    fn size(&self) -> ImageSize {
        ImageSize::Fixed(self.size, self.size)
    }

    fn filename(&self) -> String {
        match self.format {
            "png" => format!("appicon_{}.png", self.size),
            "ico" => "appicon.ico".into(),
            _ => panic!("Unknown format"),
        }
    }
}

//////////////////////////////
// Utils
//////////////////////////////

/// Determine location of the portable apps directory.
///
/// This is the parent directory of all portable app packages installed using
/// PortableApps.com Platform. It is determined as a specific parent directory from
/// the executables directory. It is only used if it is named `PortableApps` to prevent
/// messing with user's files if they do not use the PortableApps.com Platform.
///
/// This function assumes the following directory structure:
///
/// ```txt
/// BASE
/// ├───Documents
/// │   └───...
/// ├───PortableApps
/// │   ├───PWAsForFirefoxPortable
/// │   │   ├───App
/// │   │   │   ├───AppInfo
/// │   │   │   │   └───...
/// │   │   │   └───PWAsForFirefox
/// │   │   │       ├───firefoxpwa.exe
/// │   │   │       ├───firefoxpwa-connector.exe
/// │   │   │       ├───firefoxpwa-background.exe
/// │   │   │       └───...
/// │   │   ├───Data
/// │   │   │   └───...
/// │   │   └───Other
/// │   │       └───...
/// │   └───...
/// └───Start.exe
/// ```
///
fn get_portable_apps_directory(executables: &Path) -> Option<PathBuf> {
    let target = executables.ancestors().nth(3)?;

    match target.file_name().and_then(OsStr::to_str) {
        Some("PortableApps") => Some(target.into()),
        _ => None,
    }
}

//////////////////////////////
// Implementation
//////////////////////////////

/// Obtain and process icons from the icon list.
///
/// For each icon size required by the PortableApps.com specification, the best
/// available icon is downloaded and converted to a correct format. If icon cannot
/// be parsed, the next available  icon is attempted. In case no icons are available,
/// an icon is generate from the web app name.
///
fn store_icons(args: &IntegrationInstallArgs, path: &Path) -> Result<()> {
    let required = [
        PortableAppIcon { size: 16, format: "png" },
        PortableAppIcon { size: 32, format: "png" },
        PortableAppIcon { size: 75, format: "png" },
        PortableAppIcon { size: 128, format: "png" },
        PortableAppIcon { size: 256, format: "png" },
        PortableAppIcon { size: 256, format: "ico" },
    ];

    let icons = &args.site.icons();
    let fallback = &args.site.name();
    let client = args.client.unwrap();

    for icon in required {
        process_icons(icons, fallback, &icon.size(), &path.join(icon.filename()), client)?;
    }

    Ok(())
}

fn create_appinfo(args: &IntegrationInstallArgs, appid: &str, appinfo: &Path) -> Result<()> {
    // Process some known manifest categories and reformat them into PortableApps.com names
    // Apps can only have one category, so we will only use the first one
    let category = if let Some(category) = args.site.categories().first() {
        // Make category lower-case and remove all word separators for easier matching
        let category = normalize_category_name(category);

        // Get the mapped PortableApps.com category based on the web app categories
        match PORTABLEAPPS_CATEGORIES.get(&category) {
            Some(category) => category,
            None => "",
        }
    } else {
        ""
    };

    // Create an app info file and fill required info
    let mut config = Ini::new_cs();
    config.set("Format", "Type", Some("PortableAppsFormat".into()));
    config.set("Format", "Version", Some("3.7".into()));
    config.set("Details", "Name", Some(format!("{} Portable", args.site.name())));
    config.set("Details", "Description", args.site.description().into());
    config.set("Details", "Category", Some(category.into()));
    config.set("Details", "Publisher", Some(args.site.domain()));
    config.set("Details", "Homepage", Some(args.site.url()));
    config.set("Details", "AppId", Some(appid.into()));
    config.set("Details", "Language", Some("Multilingual".into()));
    config.set("Version", "PackageVersion", Some("0.0.0.0".into()));
    config.set("Version", "DisplayVersion", Some("0.0.0".into()));
    config.set("Dependencies", "Requires64bitOS", Some("yes".into()));
    config.set("Dependencies", "RequiresPortableApp", Some("PWAsForFirefoxPortable".into()));
    config.set("Control", "Start", Some("launch.vbs".into()));
    config.set("Control", "BaseAppID", Some(appid.into()));

    let protocols = args.site.config.enabled_protocol_handlers.join(",");
    config.set("Associations", "Protocols", Some(protocols));
    config.set("Associations", "ProtocolCommandLine", Some("--protocol \"%1\"".into()));

    config.write(appinfo)?;
    Ok(())
}

fn create_launcher(ulid: &str, exe: &str, launcher: &Path) -> Result<()> {
    let content = format!(
        r#"Dim arguments
For Each argument in WScript.Arguments
    arguments = arguments & """" & argument & """ "
Next

Set objShell = WScript.CreateObject("WScript.Shell")
objShell.Run "{exe} site launch {ulid}" & arguments, 0, False
"#
    );

    let mut file = File::create(launcher)?;
    file.write_all(content.as_ref())?;

    Ok(())
}

//////////////////////////////
// Interface
//////////////////////////////

#[inline]
pub fn install(args: &IntegrationInstallArgs) -> Result<()> {
    let ulid = args.site.ulid.to_string();
    let appid = format!("FFPWA-{ulid}");

    let package = match get_portable_apps_directory(&args.dirs.executables) {
        Some(package) => package.join(&appid),
        None => {
            warn!("It appears you are not using the PortableApps.com Platform");
            warn!("Skipping the system integration for this web app");
            return Ok(());
        }
    };

    let contents = package.join("App").join("AppInfo");
    create_dir_all(&contents).context("Failed to create application directory")?;

    if args.update_icons {
        store_icons(args, &contents).context("Failed to store web app icons")?;
    }

    let appinfo = contents.join("appinfo.ini");
    let launcher = package.join("launch.vbs");
    let exe = r"..\PWAsForFirefoxPortable\App\PWAsForFirefox\firefoxpwa.exe";

    create_appinfo(args, &appid, &appinfo).context("Failed to create appinfo file")?;
    create_launcher(&ulid, exe, &launcher).context("Failed to create launcher file")?;

    Ok(())
}

#[inline]
pub fn uninstall(args: &IntegrationUninstallArgs) -> Result<()> {
    let appid = format!("FFPWA-{}", args.site.ulid);

    let package = match get_portable_apps_directory(&args.dirs.executables) {
        Some(package) => package.join(appid),
        None => {
            warn!("It appears you are not using the PortableApps.com Platform");
            warn!("Skipping the system integration for this web app");
            return Ok(());
        }
    };

    let _ = remove_dir_all(package);
    Ok(())
}
