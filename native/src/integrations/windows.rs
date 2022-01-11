use std::cmp::{min, Ordering};
use std::convert::TryInto;
use std::fs::{create_dir_all, remove_dir_all, remove_file};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use data_url::DataUrl;
use image::imageops::FilterType::Gaussian;
use image::GenericImageView;
use log::{debug, error, warn};
use reqwest::header::HeaderValue;
use url::Url;
use web_app_manifest::resources::IconResource;
use web_app_manifest::types::{ImagePurpose, ImageSize, Url as ManifestUrl};
use windows::core::{Interface, IntoParam, Param, Result as WindowsResult, GUID};
use windows::Win32::Foundation::PWSTR;
use windows::Win32::Storage::EnhancedStorage::{PKEY_AppUserModel_ID, PKEY_Title};
use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
use windows::Win32::System::Com::{
    CoCreateInstance,
    CoInitializeEx,
    IPersistFile,
    CLSCTX_ALL,
    COINIT_APARTMENTTHREADED,
    COINIT_MULTITHREADED,
};
use windows::Win32::UI::Shell::Common::{IObjectArray, IObjectCollection};
use windows::Win32::UI::Shell::PropertiesSystem::{
    IPropertyStore,
    InitPropVariantFromStringVector,
};
use windows::Win32::UI::Shell::{
    DestinationList,
    EnumerableObjectCollection,
    ICustomDestinationList,
    IShellLinkW,
    ShellLink,
};
use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

use crate::directories::ProjectDirs;
use crate::integrations::{generate_icon, SiteInfoInstall, SiteInfoUninstall};

const ADD_REMOVE_PROGRAMS_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall";
const START_MENU_PROGRAMS_PATH: &str = r"Microsoft\Windows\Start Menu\Programs";

/// Initialize COM for use by the calling thread for the multi-threaded apartment (MTA).
#[inline]
fn initialize_windows() -> WindowsResult<()> {
    unsafe { CoInitializeEx(std::ptr::null_mut(), COINIT_MULTITHREADED) }
}

/// Create a COM object with the given CLSID.
#[inline]
fn create_instance<T: Interface>(clsid: &GUID) -> WindowsResult<T> {
    unsafe { CoCreateInstance(clsid, None, CLSCTX_ALL) }
}

/// Check if the icon is supported.
///
/// Supported icons must contain "any" purpose and must only have absolute URLs.
/// Other icons cannot / should not be parsed and need to be ignored.
fn is_icon_supported(icon: &IconResource) -> bool {
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
/// by their largest size. Icons larger than the max ICO size (256x256) are
/// sorted in the ascending order, and others are sorted in descending.
fn normalize_icons(icons: &[IconResource]) -> Vec<&IconResource> {
    let mut icons: Vec<&IconResource> =
        icons.iter().filter(|icon| is_icon_supported(*icon)).collect();

    icons.sort_by(|icon1, icon2| {
        let size1 = icon1.sizes.iter().max();
        let size2 = icon2.sizes.iter().max();

        if size1.is_none() || size2.is_none() {
            return Ordering::Equal;
        };

        // Unwrap is safe, because sizes is checked above
        let size1 = size1.unwrap();
        let size2 = size2.unwrap();

        if size1 >= &ImageSize::Fixed(256, 256) && size2 >= &ImageSize::Fixed(256, 256) {
            size1.cmp(size2)
        } else {
            size1.cmp(size2).reverse()
        }
    });

    icons
}

/// Download the icon from the URL.
///
/// Icon can be downloaded from the network using the `reqwest` crate
/// or decoded from a data URL. In any case, the function returns the
/// icon bytes and its content type.
fn download_icon(url: Url) -> Result<(Vec<u8>, String)> {
    if url.scheme() != "data" {
        let mut response = reqwest::blocking::get(url)?;

        let r#type = response.headers().get(reqwest::header::CONTENT_TYPE);
        let r#type = if let Some(r#type) = r#type {
            r#type.to_str()?.into()
        } else {
            "application/octet-stream".into()
        };

        let bytes = response.bytes()?.to_vec();
        Ok((bytes, r#type))
    } else {
        let url = DataUrl::process(url.as_str())?;
        let r#type = url.mime_type().to_string();
        let (bytes, _) = url.decode_to_vec()?;
        Ok((bytes, r#type))
    }
}

/// Remove all invalid characters for Windows filenames and limit the length.
///
/// Name is capped at 60 characters is double-sanitized using the
/// `sanitize_filename` crate to prevent it from containing any
/// invalid Windows filenames.
fn sanitize_name<'a>(name: &'a str, id: &'a str) -> String {
    let pattern: &[_] = &['.', ' '];

    let mut sanitized: String = name.chars().take(60).collect();
    sanitized = sanitize_filename::sanitize(sanitized);
    sanitized = sanitized.trim_end_matches(pattern).into();
    sanitized = sanitize_filename::sanitize(sanitized);

    if sanitized.is_empty() {
        format!("Site {}", &id)
    } else {
        sanitized
    }
}

/// Obtain and process the best available icon from the icon list.
///
/// Icon needs to be processed and converted to an ICO file. In case anything fails,
/// the next icons are tried. If no provided icons are working, the icon is generated
/// from the first letter of the name.
fn store_icon(name: &str, icons: &[IconResource], path: &Path) -> Result<()> {
    // Create directory for icons in case it does not exist
    // Unwrap is safe, because the path will always contain more than one component
    create_dir_all(path.parent().unwrap()).context("Failed to create icons directory")?;

    // Convert the first working icon into ICO and save it for usages in ARP page and start menu
    // Currently only one embedded image per ICO is supported: https://github.com/image-rs/image/issues/884
    for icon in normalize_icons(icons) {
        let process = || -> Result<()> {
            // Icon will always have absolute URL because of the filter in normalization
            let url: Url = icon.src.clone().try_into().unwrap();
            debug!("Processing icon {}", url);

            // Download icon and get its content type
            let (bytes, content_type) = download_icon(url).context("Failed to download icon")?;

            if content_type == "image/svg+xml" {
                debug!("Processing icon as SVG");

                let mut opt = usvg::Options::default();
                opt.fontdb.load_system_fonts();

                // Unwrap is safe, because size is valid
                let mut pixmap = tiny_skia::Pixmap::new(256, 256).unwrap();
                let transform = tiny_skia::Transform::default();

                // Parse and render SVG icons using `usvg` and `resvg` crates
                let rtree = usvg::Tree::from_data(&bytes, &opt.to_ref())
                    .context("Failed to parse SVG icon")?;
                resvg::render(&rtree, usvg::FitTo::Size(256, 256), transform, pixmap.as_mut())
                    .context("Failed to render SVG icon")?;
                image::save_buffer(&path, pixmap.data(), 256, 256, image::ColorType::Rgba8)
                    .context("Failed to save SVG icon")?;

                return Ok(());
            }

            // Parse raster icons using the `image` crate and store them as ICO files
            // Also resize them to the max ICO size (256x256) to prevent some problems
            debug!("Processing icon as raster");
            let mut img = image::load_from_memory(&bytes).context("Failed to load icon")?;
            img = img.resize(256, 256, Gaussian);
            img.save(&path).context("Failed to save icon")?;

            Ok(())
        };

        match process().context("Failed to process icon") {
            Ok(_) => return Ok(()),
            Err(error) => {
                error!("{:?}", error);
                warn!("Falling back to the next available icon");
            }
        }
    }

    warn!("No compatible or working icon was found");
    warn!("Falling back to the generated icon from the name");
    let letter = name.chars().next().context("Failed to get the first letter")?;
    generate_icon(letter, 256, path).context("Failed to generate icon")?;
    Ok(())
}

fn create_arp_entry(info: &SiteInfoInstall, exe: &str, icon: &str) -> Result<()> {
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(PathBuf::from(ADD_REMOVE_PROGRAMS_KEY).join(format!("FFPWA-{}", &info.id)))
        .context("Failed to create registry key")?;

    key.set_value("UninstallString", &format!("{} site uninstall --quiet {}", &exe, &info.id))?;
    key.set_value("DisplayIcon", &icon)?;
    key.set_value("DisplayName", &info.name)?;
    key.set_value("Publisher", &info.domain)?;
    key.set_value("URLInfoAbout", &info.url)?;
    key.set_value("NoModify", &1u32)?;
    key.set_value("NoRepair", &1u32)?;
    key.set_value("Comments", &"Installed using PWAsForFirefox")?;

    Ok(())
}

fn create_menu_shortcut(info: &SiteInfoInstall, exe: &str, icon: &str) -> Result<()> {
    // Sanitize the name to prevent overflows and invalid filenames
    let name = sanitize_name(&info.name, &info.id);

    // Create shell link instance
    let link: IShellLinkW = create_instance(&ShellLink)?;

    unsafe {
        // Set general shortcut properties
        link.SetPath(exe)?;
        link.SetArguments(format!("site launch {}", info.id))?;
        link.SetDescription(info.description.chars().take(240).collect::<String>())?;
        link.SetIconLocation(icon, 0)?;
        link.SetShowCmd(7)?;

        // Set app user model ID property
        // Docs: https://docs.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-id
        let store: IPropertyStore = link.cast()?;
        let mut param: Param<PWSTR> = format!("filips.firefoxpwa.{}", info.id).into_param();
        let mut variant: PROPVARIANT = InitPropVariantFromStringVector(&param.abi(), 1)?;
        store.SetValue(&PKEY_AppUserModel_ID, &variant)?;
        store.Commit()?;
    }

    let filename = directories::BaseDirs::new()
        .context("Failed to determine base system directories")?
        .data_dir()
        .join(START_MENU_PROGRAMS_PATH)
        .join(name)
        .with_extension("lnk")
        .display()
        .to_string();

    unsafe {
        // Save shortcut to file
        let persist: IPersistFile = link.cast()?;
        persist.Save(filename, true)?;
    }

    Ok(())
}

fn create_jump_list_tasks(info: &SiteInfoInstall, dirs: &ProjectDirs, exe: &str) -> Result<()> {
    let appid = format!("filips.firefoxpwa.{}", info.id);

    // Create jump list and set its app ID and number of tasks
    let list: ICustomDestinationList = create_instance(&DestinationList)?;

    unsafe {
        if info.shortcuts.is_empty() {
            list.DeleteList(appid)?;
            return Ok(());
        } else {
            list.SetAppID(appid.clone())?;
            let _: IObjectArray = list.BeginList(&mut (info.shortcuts.len() as u32))?;
        }
    }

    // Create task collection and add tasks
    let collection: IObjectCollection = create_instance(&EnumerableObjectCollection)?;

    for (i, shortcut) in info.shortcuts.iter().enumerate() {
        let url: Url = shortcut.url.clone().try_into().context("Failed to convert shortcut URL")?;

        let icon = dirs
            .userdata
            .join("icons")
            .join(&info.id)
            .join(format!("shortcut{}", i))
            .with_extension("ico");

        store_icon(&shortcut.name, &shortcut.icons, &icon)
            .context("Failed to store shortcut icon")?;

        let description = shortcut.description.clone().unwrap_or_else(|| "".into());
        let icon = icon.display().to_string();

        // Create shell link and property store instances
        let link: IShellLinkW = create_instance(&ShellLink)?;
        let store: IPropertyStore = link.cast()?;

        unsafe {
            // Set general shortcut properties
            link.SetPath(exe)?;
            link.SetArguments(format!("site launch {} --url {}", info.id, url))?;
            link.SetDescription(description.chars().take(240).collect::<String>())?;
            link.SetIconLocation(icon, 0)?;
            link.SetShowCmd(7)?;

            // Set app user model ID property
            // Docs: https://docs.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-id
            let mut param: Param<PWSTR> = appid.clone().into_param();
            let mut variant: PROPVARIANT = InitPropVariantFromStringVector(&param.abi(), 1)?;
            store.SetValue(&PKEY_AppUserModel_ID, &variant)?;
            store.Commit()?;

            // Set title property
            // Docs: https://docs.microsoft.com/en-us/windows/win32/properties/props-system-title
            let mut param: Param<PWSTR> = shortcut.name.clone().into_param();
            let mut variant: PROPVARIANT = InitPropVariantFromStringVector(&param.abi(), 1)?;
            store.SetValue(&PKEY_Title, &variant)?;

            // Commit store and add it to collection
            store.Commit()?;
            collection.AddObject(link)?;
        }
    }

    unsafe {
        // Add all tasks to the jump list
        let tasks: IObjectArray = collection.cast()?;
        list.AddUserTasks(&tasks)?;
        list.CommitList()?;
    }

    Ok(())
}

#[inline]
pub fn install(info: &SiteInfoInstall, dirs: &ProjectDirs) -> Result<()> {
    let _ = remove_dir_all(dirs.userdata.join("icons").join(&info.id));

    let exe = dirs.executables.join("firefoxpwa.exe");
    let icon = dirs.userdata.join("icons").join(&info.id).join("site").with_extension("ico");
    store_icon(&info.name, info.icons, &icon).context("Failed to store site icon")?;

    let exe = exe.display().to_string();
    let icon = icon.display().to_string();

    initialize_windows()?;
    create_arp_entry(info, &exe, &icon).context("Failed to create ARP entry")?;
    create_menu_shortcut(info, &exe, &icon).context("Failed to create menu shortcut")?;
    create_jump_list_tasks(info, dirs, &exe).context("Failed to create jump list tasks")?;

    Ok(())
}

#[inline]
pub fn uninstall(info: &SiteInfoUninstall, dirs: &ProjectDirs) -> Result<()> {
    // Sanitize the name to prevent overflows and invalid filenames
    let name = sanitize_name(&info.name, &info.id);

    // Remove icons
    let icon = dirs.userdata.join("icons").join(&info.id);
    let _ = remove_dir_all(icon);

    // Remove ARP entry
    let key = PathBuf::from(ADD_REMOVE_PROGRAMS_KEY).join(format!("FFPWA-{}", &info.id));
    let _ = RegKey::predef(HKEY_CURRENT_USER).delete_subkey_all(key);

    // Remove start menu shortcut
    let shortcut = PathBuf::from(std::env::var("AppData")?)
        .join(START_MENU_PROGRAMS_PATH)
        .join(name)
        .with_extension("lnk");
    let _ = remove_file(shortcut);

    // Remove jump list tasks
    unsafe {
        initialize_windows()?;
        let list: ICustomDestinationList = create_instance(&DestinationList)?;
        let _ = list.DeleteList(format!("filips.firefoxpwa.{}", info.id));
    }

    Ok(())
}
