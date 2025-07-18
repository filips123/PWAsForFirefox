use std::fs::{copy, create_dir_all, remove_dir_all, remove_file, rename};
use std::path::Path;

use anyhow::{Context, Result};
use log::warn;
use reqwest::blocking::Client;
use url::Url;
use web_app_manifest::resources::IconResource;
use web_app_manifest::types::ImageSize;
use windows::Win32::Storage::EnhancedStorage::{PKEY_AppUserModel_ID, PKEY_Title};
use windows::Win32::System::Com::StructuredStorage::InitPropVariantFromStringVector;
use windows::Win32::System::Com::{
    CLSCTX_ALL,
    COINIT_DISABLE_OLE1DDE,
    COINIT_MULTITHREADED,
    CoCreateInstance,
    CoInitializeEx,
    IPersistFile,
};
use windows::Win32::UI::Shell::Common::{IObjectArray, IObjectCollection};
use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
use windows::Win32::UI::Shell::{
    DestinationList,
    EnumerableObjectCollection,
    ICustomDestinationList,
    IShellLinkW,
    ShellLink,
};
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWMINNOACTIVE;
use windows::core::{GUID, HSTRING, Interface, PCWSTR, Result as WindowsResult};
use windows_registry::{CURRENT_USER, Key};

use crate::components::site::Site;
use crate::integrations::utils::{process_icons, sanitize_name};
use crate::integrations::{IntegrationInstallArgs, IntegrationUninstallArgs};
use crate::utils::sanitize_string;

const ADD_REMOVE_PROGRAMS_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall";
const REGISTERED_APPLICATIONS_KEY: &str = r"Software\RegisteredApplications";
const START_MENU_PROGRAMS_PATH: &str = r"Microsoft\Windows\Start Menu\Programs";
const STARTUP_PROGRAMS_PATH: &str = r"Microsoft\Windows\Start Menu\Programs\Startup";

//////////////////////////////
// Utils
//////////////////////////////

/// Initialize COM for use by the calling thread for the multi-threaded apartment (MTA).
#[inline]
fn initialize_windows() -> WindowsResult<()> {
    unsafe { CoInitializeEx(None, COINIT_MULTITHREADED | COINIT_DISABLE_OLE1DDE).ok() }
}

/// Create a COM object with the given CLSID.
#[inline]
fn create_instance<T: Interface>(clsid: &GUID) -> WindowsResult<T> {
    unsafe { CoCreateInstance(clsid, None, CLSCTX_ALL) }
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
    let key = CURRENT_USER
        .create(format!(r"{ADD_REMOVE_PROGRAMS_KEY}\{}", &ids.regid))
        .context("Failed to create registry key")?;

    key.set_string("UninstallString", format!("{} site uninstall --quiet {}", &exe, &ids.ulid))?;
    key.set_string("DisplayIcon", icon)?;
    key.set_string("DisplayName", &ids.name)?;
    key.set_string("Publisher", args.site.domain())?;
    key.set_string("URLInfoAbout", args.site.url())?;
    key.set_u32("NoModify", 1u32)?;
    key.set_u32("NoRepair", 1u32)?;
    key.set_string("Comments", "Installed using PWAsForFirefox")?;

    Ok(())
}

fn create_menu_shortcut(
    args: &IntegrationInstallArgs,
    ids: &SiteIds,
    exe: &str,
    icon: &str,
    data: &Path,
) -> Result<()> {
    let start_menu_dir = data.join(START_MENU_PROGRAMS_PATH);

    // Sanitize the name to prevent overflows and invalid filenames
    let name = sanitize_name(&ids.name, &ids.ulid);
    let filename = start_menu_dir.join(name).with_extension("lnk");

    // If the name has been changed, first rename the shortcut file
    if let Some(old_name) = &args.old_name {
        let old_name = sanitize_name(old_name, &ids.ulid);
        let old_filename = start_menu_dir.join(old_name).with_extension("lnk");

        if let Err(error) = rename(old_filename, &filename).context("Failed to rename shortcut") {
            warn!("{error:?}");
        }
    }

    // Create shell link instance
    let link: IShellLinkW = create_instance(&ShellLink)?;

    unsafe {
        // Set general shortcut properties
        link.SetPath(&HSTRING::from(exe))?;
        link.SetArguments(&HSTRING::from(format!("site launch {}", ids.ulid)))?;
        link.SetDescription(&HSTRING::from(ids.description.chars().take(240).collect::<String>()))?;
        link.SetIconLocation(&HSTRING::from(icon), 0)?;
        link.SetShowCmd(SW_SHOWMINNOACTIVE)?;

        // Set app user model ID property
        // Docs: https://docs.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-id
        let store: IPropertyStore = link.cast()?;
        let hstring = HSTRING::from(&ids.appid);
        let variant = InitPropVariantFromStringVector(Some(&[PCWSTR(hstring.as_ptr())]))?;
        store.SetValue(&PKEY_AppUserModel_ID, &variant)?;
        store.Commit()?;

        // Save shortcut to file
        let persist: IPersistFile = link.cast()?;
        persist.Save(&HSTRING::from(filename.display().to_string()), true)?;
    }

    Ok(())
}

fn create_shell_startup_shortcut(
    args: &IntegrationInstallArgs,
    ids: &SiteIds,
    data: &Path,
) -> Result<()> {
    let menu_dir = data.join(START_MENU_PROGRAMS_PATH);
    let startup_dir = data.join(STARTUP_PROGRAMS_PATH);

    let name = sanitize_name(&ids.name, &ids.ulid);
    let menu_filename = menu_dir.join(&name).with_extension("lnk");
    let startup_filename = startup_dir.join(&name).with_extension("lnk");

    // If old name is not the same as new one, remove the old shortcut
    if let Some(old_name) = &args.old_name {
        let old_name = sanitize_name(old_name, &ids.ulid);
        let old_filename = startup_dir.join(&old_name).with_extension("lnk");

        if old_name != name {
            let _ = remove_file(old_filename);
        }
    }

    if args.site.config.launch_on_login {
        // If launch on login is enabled, copy its shortcut to the startup directory
        copy(menu_filename, startup_filename).context("Failed to copy startup shortcut")?;
    } else {
        // Otherwise, try to remove its shortcut from the startup directory
        let _ = remove_file(startup_filename);
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
        let name = sanitize_string(&shortcut.name);
        let description = sanitize_string(shortcut.description.as_deref().unwrap_or(""));
        let icon = icons.join(format!("shortcut{i}.ico",));

        if args.update_icons {
            store_icon(&name, &shortcut.icons, &icon, args.client.unwrap())
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
            link.SetShowCmd(SW_SHOWMINNOACTIVE)?;

            // Set app user model ID property
            // Docs: https://docs.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-id
            let hstring = HSTRING::from(&ids.appid);
            let variant = InitPropVariantFromStringVector(Some(&[PCWSTR(hstring.as_ptr())]))?;
            store.SetValue(&PKEY_AppUserModel_ID, &variant)?;

            // Set title property
            // Docs: https://docs.microsoft.com/en-us/windows/win32/properties/props-system-title
            let hstring = HSTRING::from(&name);
            let variant = InitPropVariantFromStringVector(Some(&[PCWSTR(hstring.as_ptr())]))?;
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
    let assign_values = |key: &Key| -> Result<()> {
        key.set_string("ApplicationName", &ids.name)
            .context("Failed to set ApplicationName application key")?;
        key.set_string("ApplicationDescription", &ids.description)
            .context("Failed to set ApplicationDescription application key")?;
        key.set_string("ApplicationIcon", format!("{icon},0"))
            .context("Failed to set ApplicationIcon application key")?;
        key.set_string("AppUserModelID", &ids.appid)
            .context("Failed to set AppUserModelID application key")?;
        Ok(())
    };

    let capabilities_path = format!(r"Software\filips\FirefoxPWA\{}\Capabilities", ids.regid);
    let classes_path = format!(r"Software\Classes\{}", ids.regid);

    // Add web app to a list of registered applications
    CURRENT_USER
        .create(REGISTERED_APPLICATIONS_KEY)
        .context("Failed to open RegisteredApplications list")?
        .set_string(&ids.regid, &capabilities_path)
        .context("Failed to add to RegisteredApplications list")?;

    // Register application details
    let application = CURRENT_USER
        .create(format!(r"{classes_path}\Application"))
        .context("Failed to create application registry key")?;
    let capabilities = CURRENT_USER
        .create(&capabilities_path)
        .context("Failed to create capabilities registry key")?;
    assign_values(&application).context("Failed to set application registry key")?;
    assign_values(&capabilities).context("Failed to set capabilities registry key")?;

    // Register application open commands
    let ulid = &ids.ulid;
    CURRENT_USER
        .create(format!(r"{classes_path}\Shell\open\command"))
        .context("Failed to create open command registry key")?
        .set_string("", format!("\"{exe}\" site launch {ulid} --protocol \"%1\""))
        .context("Failed to set open command registry key")?;

    // Create URL associations key
    let associations = CURRENT_USER
        .create(format!(r"{capabilities_path}\UrlAssociations"))
        .context("Failed to create URL associations registry key")?;

    // Remove existing protocol handlers
    if let Ok(protocols) = associations.values() {
        for (protocol, _) in protocols {
            let _ = associations.remove_value(protocol);
        }
    }

    // Add enabled protocol handlers
    for protocol in &args.site.config.enabled_protocol_handlers {
        associations
            .set_string(sanitize_string(protocol), ids.regid.clone())
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
        store_icon(&ids.name, &args.site.icons(), &icon_path, args.client.unwrap())
            .context("Failed to store web app icon")?;
    }

    let icon_path = icon_path.display().to_string();
    let exe_path = exe_path.display().to_string();

    let data = directories::BaseDirs::new()
        .context("Failed to determine base system directories")?
        .data_dir()
        .to_owned();

    initialize_windows()?;

    create_arp_entry(args, &ids, &exe_path, &icon_path)
        .context("Failed to create ARP list entry")?;
    create_menu_shortcut(args, &ids, &exe_path, &icon_path, &data)
        .context("Failed to create start menu shortcut")?;
    create_shell_startup_shortcut(args, &ids, &data)
        .context("Failed to create shell startup shortcut")?;
    create_jump_list_tasks(args, &ids, &exe_path, &icons_directory)
        .context("Failed to create jump list tasks")?;
    register_protocol_handlers(args, &ids, &exe_path, &icon_path)
        .context("Failed to register protocol handlers")?;

    Ok(())
}

#[inline]
pub fn uninstall(args: &IntegrationUninstallArgs) -> Result<()> {
    let ids = SiteIds::create_for(args.site);

    // Sanitize the name to prevent overflows and invalid filenames
    let name = sanitize_name(&ids.name, &ids.ulid);

    // Remove icons
    let icons_directory = args.dirs.userdata.join("icons").join(&ids.ulid);
    let _ = remove_dir_all(icons_directory);

    // Remove ARP entry
    let _ = CURRENT_USER.remove_tree(format!(r"{ADD_REMOVE_PROGRAMS_KEY}\{}", &ids.regid));

    let data = directories::BaseDirs::new()
        .context("Failed to determine base system directories")?
        .data_dir()
        .to_owned();

    // Remove start menu shortcut
    let start_menu_shortcut = data.join(START_MENU_PROGRAMS_PATH).join(&name).with_extension("lnk");
    let _ = remove_file(start_menu_shortcut);

    // Remove startup shortcut
    let startup_shortcut = data.join(STARTUP_PROGRAMS_PATH).join(&name).with_extension("lnk");
    let _ = remove_file(startup_shortcut);

    // Remove jump list tasks
    unsafe {
        initialize_windows()?;
        let list: ICustomDestinationList = create_instance(&DestinationList)?;
        let _ = list.DeleteList(&HSTRING::from(ids.appid));
    }

    // Remove protocol handlers
    if let Ok(key) = CURRENT_USER.create(REGISTERED_APPLICATIONS_KEY) {
        let _ = key.remove_value(&ids.regid);
    }
    let _ = CURRENT_USER.remove_tree(format!(r"Software\FirefoxPWA\{}", ids.regid));
    let _ = CURRENT_USER.remove_tree(format!(r"Software\Classes\{}", ids.regid));

    Ok(())
}
