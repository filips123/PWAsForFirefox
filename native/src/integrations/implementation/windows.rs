use std::convert::TryInto;
use std::fs::{create_dir_all, remove_dir_all, remove_file};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use url::Url;
use web_app_manifest::resources::IconResource;
use web_app_manifest::types::ImageSize;
use windows::core::{Interface, Result as WindowsResult, GUID, PWSTR};
use windows::Win32::Storage::EnhancedStorage::{PKEY_AppUserModel_ID, PKEY_Title};
use windows::Win32::System::Com::{
    CoCreateInstance,
    CoInitializeEx,
    IPersistFile,
    CLSCTX_ALL,
    COINIT_DISABLE_OLE1DDE,
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
use crate::integrations::utils::{process_icons, sanitize_name};
use crate::integrations::{SiteInfoInstall, SiteInfoUninstall};

const ADD_REMOVE_PROGRAMS_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall";
const START_MENU_PROGRAMS_PATH: &str = r"Microsoft\Windows\Start Menu\Programs";

//////////////////////////////
// Utils
//////////////////////////////

/// Initialize COM for use by the calling thread for the multi-threaded apartment (MTA).
#[inline]
fn initialize_windows() -> WindowsResult<()> {
    unsafe { CoInitializeEx(std::ptr::null_mut(), COINIT_MULTITHREADED | COINIT_DISABLE_OLE1DDE) }
}

/// Create a COM object with the given CLSID.
#[inline]
fn create_instance<T: Interface>(clsid: &GUID) -> WindowsResult<T> {
    unsafe { CoCreateInstance(clsid, None, CLSCTX_ALL) }
}

/// Construct a `windows-rs`'s [`PWSTR`] from a [`&str`].
///
/// See: https://github.com/microsoft/windows-rs/issues/973#issue-942298423
#[inline]
fn string_to_pwstr(str: &str) -> PWSTR {
    let mut encoded = str.encode_utf16().chain([0u16]).collect::<Vec<u16>>();
    PWSTR(encoded.as_mut_ptr())
}

//////////////////////////////
// Implementation
//////////////////////////////

/// Obtain and process the best available app/shortcut icon from the icon list.
///
/// Icon needs to be processed and converted to an ICO file. In case anything fails,
/// the next icons are tried. If no provided icons are working, the icon is generated
/// from the first letter of the name.
///
/// See [`process_icons`] for more details.
///
/// # Parameters
///
/// - `name`:  A web app or shortcut name. Used to generate a fallback icon.
/// - `icons`: A list of available icons for the web app or shortcut.
/// - `path`:  A path where the icon should be saved.
///
fn store_icon(name: &str, icons: &[IconResource], path: &Path) -> Result<()> {
    // Create directory for icons in case it does not exist
    // Unwrap is safe, because the path will always contain more than one component
    create_dir_all(path.parent().unwrap()).context("Failed to create icons directory")?;

    // Currently only one embedded image per ICO is supported: https://github.com/image-rs/image/issues/884
    // Until more embedded images are supported, use the max ICO size (256x256)
    let size = &ImageSize::Fixed(256, 256);
    process_icons(icons, name, size, path)
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
        let appid = format!("filips.firefoxpwa.{}", info.id);
        let variant = InitPropVariantFromStringVector(&[string_to_pwstr(&appid)])?;
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
            let variant = InitPropVariantFromStringVector(&[string_to_pwstr(&appid)])?;
            store.SetValue(&PKEY_AppUserModel_ID, &variant)?;

            // Set title property
            // Docs: https://docs.microsoft.com/en-us/windows/win32/properties/props-system-title
            let variant = InitPropVariantFromStringVector(&[string_to_pwstr(&shortcut.name)])?;
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

//////////////////////////////
// Interface
//////////////////////////////

#[inline]
pub fn install(info: &SiteInfoInstall, dirs: &ProjectDirs) -> Result<()> {
    let _ = remove_dir_all(dirs.userdata.join("icons").join(&info.id));

    let exe = dirs.executables.join("firefoxpwa.exe");
    let icon = dirs.userdata.join("icons").join(&info.id).join("site").with_extension("ico");
    store_icon(&info.name, info.icons, &icon).context("Failed to store web app icon")?;

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
    let shortcut = directories::BaseDirs::new()
        .context("Failed to determine base system directories")?
        .data_dir()
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
