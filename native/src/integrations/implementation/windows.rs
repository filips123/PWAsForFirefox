use std::convert::TryInto;
use std::fs::{create_dir_all, remove_dir_all, remove_file, rename};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use reqwest::blocking::Client;
use url::Url;
use web_app_manifest::resources::IconResource;
use web_app_manifest::types::ImageSize;
use windows::core::{Interface, Result as WindowsResult, GUID, HSTRING, PWSTR};
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

use crate::components::site::Site;
use crate::integrations::utils::{process_icons, sanitize_name};
use crate::integrations::{IntegrationInstallArgs, IntegrationUninstallArgs};

const ADD_REMOVE_PROGRAMS_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall";
const REGISTERED_APPLICATIONS_KEY: &str = r"Software\RegisteredApplications";
const START_MENU_PROGRAMS_PATH: &str = r"Microsoft\Windows\Start Menu\Programs";

//////////////////////////////
// Utils
//////////////////////////////

/// Initialize COM for use by the calling thread for the multi-threaded apartment (MTA).
#[inline]
fn initialize_windows() -> WindowsResult<()> {
    unsafe { CoInitializeEx(None, COINIT_MULTITHREADED | COINIT_DISABLE_OLE1DDE) }
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
fn str_to_pwstr(str: &str) -> PWSTR {
    let mut encoded = str.encode_utf16().chain([0u16]).collect::<Vec<u16>>();
    PWSTR(encoded.as_mut_ptr())
}

//////////////////////////////
// Implementation
//////////////////////////////

#[derive(Debug, Clone)]
struct SiteIds {
    pub name: String,
    pub description: String,
    pub ulid: String,
    pub regid: String,
    pub appid: String,
}

impl SiteIds {
    pub fn create_for(site: &Site) -> Self {
        let name = site.name();
        let description = site.description();
        let ulid = site.ulid.to_string();
        let regid = format!("FFPWA-{ulid}");
        let appid = format!("filips.firefoxpwa.{ulid}");
        Self { name, description, ulid, regid, appid }
    }
}

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
/// - `client`: An instance of a blocking HTTP client.
///
fn store_icon(name: &str, icons: &[IconResource], path: &Path, client: &Client) -> Result<()> {
    // Currently only one embedded image per ICO is supported: https://github.com/image-rs/image/issues/884
    // Until more embedded images are supported, use the max ICO size (256x256)
    let size = &ImageSize::Fixed(256, 256);
    process_icons(icons, name, size, path, client)
}

fn create_arp_entry(
    args: &IntegrationInstallArgs,
    ids: &SiteIds,
    exe: &str,
    icon: &str,
) -> Result<()> {
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(PathBuf::from(ADD_REMOVE_PROGRAMS_KEY).join(&ids.regid))
        .context("Failed to create registry key")?;

    key.set_value("UninstallString", &format!("{} site uninstall --quiet {}", &exe, &ids.ulid))?;
    key.set_value("DisplayIcon", &icon)?;
    key.set_value("DisplayName", &ids.name)?;
    key.set_value("Publisher", &args.site.domain())?;
    key.set_value("URLInfoAbout", &args.site.url())?;
    key.set_value("NoModify", &1u32)?;
    key.set_value("NoRepair", &1u32)?;
    key.set_value("Comments", &"Installed using PWAsForFirefox")?;

    Ok(())
}

fn create_menu_shortcut(
    args: &IntegrationInstallArgs,
    ids: &SiteIds,
    exe: &str,
    icon: &str,
) -> Result<()> {
    let start_menu_dir = directories::BaseDirs::new()
        .context("Failed to determine base system directories")?
        .data_dir()
        .join(START_MENU_PROGRAMS_PATH);

    // Sanitize the name to prevent overflows and invalid filenames
    let name = sanitize_name(&ids.name, &ids.ulid);
    let filename = start_menu_dir.join(name).with_extension("lnk");

    // If the name has been changed, first rename the shortcut file
    if let Some(old_name) = &args.old_name {
        let old_name = sanitize_name(old_name, &ids.ulid);
        let old_filename = start_menu_dir.join(old_name).with_extension("lnk");
        rename(old_filename, &filename).context("Failed to rename shortcut")?;
    }

    // Create shell link instance
    let link: IShellLinkW = create_instance(&ShellLink)?;

    unsafe {
        // Set general shortcut properties
        link.SetPath(&HSTRING::from(exe))?;
        link.SetArguments(&HSTRING::from(format!("site launch {}", ids.ulid)))?;
        link.SetDescription(&HSTRING::from(ids.description.chars().take(240).collect::<String>()))?;
        link.SetIconLocation(&HSTRING::from(icon), 0)?;
        link.SetShowCmd(7)?;

        // Set app user model ID property
        // Docs: https://docs.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-id
        let store: IPropertyStore = link.cast()?;
        let variant = InitPropVariantFromStringVector(Some(&[str_to_pwstr(&ids.appid)]))?;
        store.SetValue(&PKEY_AppUserModel_ID, &variant)?;
        store.Commit()?;

        // Save shortcut to file
        let persist: IPersistFile = link.cast()?;
        persist.Save(&HSTRING::from(filename.display().to_string()), true)?;
    }

    Ok(())
}

fn create_jump_list_tasks(
    args: &IntegrationInstallArgs,
    ids: &SiteIds,
    exe: &str,
    icons: &Path,
) -> Result<()> {
    let shortcuts = &args.site.manifest.shortcuts;

    // Create jump list and set its app ID and number of tasks
    let list: ICustomDestinationList = create_instance(&DestinationList)?;

    unsafe {
        if shortcuts.is_empty() {
            list.DeleteList(&HSTRING::from(&ids.appid))?;
            return Ok(());
        } else {
            list.SetAppID(&HSTRING::from(&ids.appid))?;
            let _: IObjectArray = list.BeginList(&mut (shortcuts.len() as u32))?;
        }
    }

    // Create task collection and add tasks
    let collection: IObjectCollection = create_instance(&EnumerableObjectCollection)?;

    for (i, shortcut) in shortcuts.iter().enumerate() {
        let url: Url = shortcut.url.clone().try_into().context("Failed to convert shortcut URL")?;
        let description = shortcut.description.clone().unwrap_or_else(|| "".into());
        let icon = icons.join(format!("shortcut{i}.ico",));

        if args.update_icons {
            store_icon(&shortcut.name, &shortcut.icons, &icon, args.client.unwrap())
                .context("Failed to store shortcut icon")?;
        }

        // Create shell link and property store instances
        let link: IShellLinkW = create_instance(&ShellLink)?;
        let store: IPropertyStore = link.cast()?;

        unsafe {
            // Set general shortcut properties
            link.SetPath(&HSTRING::from(exe))?;
            link.SetArguments(&HSTRING::from(format!("site launch {} --url {}", ids.ulid, url)))?;
            link.SetDescription(&HSTRING::from(description.chars().take(240).collect::<String>()))?;
            link.SetIconLocation(&HSTRING::from(icon.display().to_string()), 0)?;
            link.SetShowCmd(7)?;

            // Set app user model ID property
            // Docs: https://docs.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-id
            let variant = InitPropVariantFromStringVector(Some(&[str_to_pwstr(&ids.appid)]))?;
            store.SetValue(&PKEY_AppUserModel_ID, &variant)?;

            // Set title property
            // Docs: https://docs.microsoft.com/en-us/windows/win32/properties/props-system-title
            let variant = InitPropVariantFromStringVector(Some(&[str_to_pwstr(&shortcut.name)]))?;
            store.SetValue(&PKEY_Title, &variant)?;

            // Commit store and add it to collection
            store.Commit()?;
            collection.AddObject(&link)?;
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

fn register_protocol_handlers(
    args: &IntegrationInstallArgs,
    ids: &SiteIds,
    exe: &str,
    icon: &str,
) -> Result<()> {
    let assign_values = |key: RegKey| -> Result<()> {
        key.set_value("ApplicationName", &ids.name)
            .context("Failed to set ApplicationName application key")?;
        key.set_value("ApplicationDescription", &ids.description)
            .context("Failed to set ApplicationDescription application key")?;
        key.set_value("ApplicationIcon", &format!("{icon},0"))
            .context("Failed to set ApplicationIcon application key")?;
        key.set_value("AppUserModelID", &ids.appid)
            .context("Failed to set AppUserModelID application key")?;
        Ok(())
    };

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let capabilities_path = format!(r"Software\filips\FirefoxPWA\{}\Capabilities", ids.regid);
    let classes_path = format!(r"Software\Classes\{}", ids.regid);

    // Add web app to a list of registered applications
    let (registered_applications, _) = hkcu
        .create_subkey(REGISTERED_APPLICATIONS_KEY)
        .context("Failed to open RegisteredApplications list")?;
    registered_applications
        .set_value(&ids.regid, &capabilities_path)
        .context("Failed to add to RegisteredApplications list")?;

    // Register application details
    let (application, _) = hkcu
        .create_subkey(format!(r"{classes_path}\Application"))
        .context("Failed to create application registry key")?;
    let (capabilities, _) = hkcu
        .create_subkey(&capabilities_path)
        .context("Failed to create capabilities registry key")?;
    assign_values(application).context("Failed to set application registry key")?;
    assign_values(capabilities).context("Failed to set capabilities registry key")?;

    // Register application open commands
    let ulid = &ids.ulid;
    let (open_command, _) = hkcu
        .create_subkey(format!(r"{classes_path}\Shell\open\command"))
        .context("Failed to create open command registry key")?;
    open_command
        .set_value("", &format!("\"{exe}\" site launch {ulid} --protocol \"%1\""))
        .context("Failed to set open command registry key")?;

    // Create URL associations key
    let (associations, _) = hkcu
        .create_subkey(format!(r"{capabilities_path}\UrlAssociations"))
        .context("Failed to create URL associations registry key")?;

    // Remove existing protocol handlers
    for (protocol, _) in associations.enum_values().filter_map(|item| item.ok()) {
        let _ = associations.delete_value(protocol);
    }

    // Add enabled protocol handlers
    for protocol in &args.site.config.enabled_protocol_handlers {
        associations
            .set_value(protocol, &ids.regid)
            .context("Failed to set protocol registry key")?;
    }

    Ok(())
}

//////////////////////////////
// Interface
//////////////////////////////

#[inline]
pub fn install(args: &IntegrationInstallArgs) -> Result<()> {
    let ids = SiteIds::create_for(args.site);

    let icons_directory = args.dirs.userdata.join("icons").join(&ids.ulid);
    let icon_path = icons_directory.join("site.ico");
    let exe_path = args.dirs.executables.join("firefoxpwa.exe");

    if args.update_icons {
        // Clear all existing icons and re-create a directory
        let _ = remove_dir_all(&icons_directory);
        create_dir_all(&icons_directory).context("Failed to create icons directory")?;

        // Store new site icon (shortcut icons will be added later)
        store_icon(&ids.name, &args.site.manifest.icons, &icon_path, args.client.unwrap())
            .context("Failed to store web app icon")?;
    }

    let icon_path = icon_path.display().to_string();
    let exe_path = exe_path.display().to_string();

    initialize_windows()?;

    create_arp_entry(args, &ids, &exe_path, &icon_path)
        .context("Failed to create ARP list entry")?;
    create_menu_shortcut(args, &ids, &exe_path, &icon_path)
        .context("Failed to create menu shortcut")?;
    create_jump_list_tasks(args, &ids, &exe_path, &icons_directory)
        .context("Failed to create jump list tasks")?;
    register_protocol_handlers(args, &ids, &exe_path, &icon_path)
        .context("Failed to register protocol handlers")?;

    Ok(())
}

#[inline]
pub fn uninstall(args: &IntegrationUninstallArgs) -> Result<()> {
    let ids = SiteIds::create_for(args.site);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    // Sanitize the name to prevent overflows and invalid filenames
    let name = sanitize_name(&ids.name, &ids.ulid);

    // Remove icons
    let icons_directory = args.dirs.userdata.join("icons").join(&ids.ulid);
    let _ = remove_dir_all(icons_directory);

    // Remove ARP entry
    let _ = hkcu.delete_subkey_all(PathBuf::from(ADD_REMOVE_PROGRAMS_KEY).join(&ids.regid));

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
        let _ = list.DeleteList(&HSTRING::from(ids.appid));
    }

    // Remove protocol handlers
    if let Ok((key, _)) = hkcu.create_subkey(REGISTERED_APPLICATIONS_KEY) {
        let _ = key.delete_value(&ids.regid);
    }
    let _ = hkcu.delete_subkey_all(format!(r"Software\FirefoxPWA\{}", ids.regid));
    let _ = hkcu.delete_subkey_all(format!(r"Software\Classes\{}", ids.regid));

    Ok(())
}
