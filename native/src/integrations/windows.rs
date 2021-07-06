use std::cmp::{min, Ordering};
use std::convert::TryInto;
use std::fs::{create_dir_all, remove_dir_all, remove_file};
use std::path::PathBuf;

use anyhow::{Context, Result};
use bindings::Windows::Win32::Foundation::PWSTR;
use bindings::Windows::Win32::Storage::StructuredStorage::PROPVARIANT;
use bindings::Windows::Win32::System::Com::IPersistFile;
use bindings::Windows::Win32::System::PropertiesSystem::{
    IPropertyStore,
    InitPropVariantFromStringVector,
    PROPERTYKEY,
};
use bindings::Windows::Win32::UI::Shell::{
    DestinationList,
    EnumerableObjectCollection,
    ICustomDestinationList,
    IObjectArray,
    IObjectCollection,
    IShellLinkW,
    ShellLink,
};
use image::imageops::FilterType::Gaussian;
use image::GenericImageView;
use url::Url;
use web_app_manifest::resources::IconResource;
use web_app_manifest::types::{ImagePurpose, ImageSize};
use windows::{Guid, Interface, IntoParam, Param};
use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

use crate::directories::ProjectDirs;
use crate::integrations::{SiteInfoInstall, SiteInfoUninstall};

fn store_icon(
    siteid: &str,
    iconid: &str,
    icons: &[IconResource],
    dirs: &ProjectDirs,
    resize: bool,
) -> Result<String> {
    // Sort icons by their largest size
    let icons: &mut Vec<IconResource> = &mut icons.to_vec();
    icons.sort_by(|icon1, icon2| {
        let size1 = icon1.sizes.iter().max();
        let size2 = icon2.sizes.iter().max();

        if size1.is_none() || size2.is_none() {
            return Ordering::Equal;
        };

        let size1 = size1.unwrap();
        let size2 = size2.unwrap();

        size1.cmp(&size2)
    });

    // Get the first icon larger or equal to 256 (max ICO size), and if there is none, largest of all
    let icon = icons
        .iter()
        .find(|icon| {
            icon.sizes.iter().max() >= Some(&ImageSize::Fixed(256, 256))
                && icon.purpose.contains(&ImagePurpose::Any)
        })
        .or_else(|| icons.iter().rev().find(|icon| icon.purpose.contains(&ImagePurpose::Any)));

    // Convert the chosen icon into ICO and save it for usages in ARP page and start menu
    // Currently only one embedded image per ICO is supported: https://github.com/image-rs/image/issues/884
    let icon = match icon {
        Some(icon) => {
            let url: Url = icon.src.clone().try_into().context("Failed to convert icon URL")?;
            let response = reqwest::blocking::get(url).context("Failed to download icon")?;
            let bytes = &response.bytes().context("Failed to read icon")?;
            let mut img = image::load_from_memory(bytes).context("Failed to load icon")?;

            if resize {
                // Force resize to 256x256 which is needed for jump list tasks
                img = img.resize(256, 256, Gaussian);
            } else {
                // For other icons keep original size but cap it at the max ICO size
                let (width, height) = img.dimensions();
                if width > 256 || height > 256 {
                    img = img.resize(min(256, width), min(256, height), Gaussian);
                }
            }

            let directory = dirs.data.join("icons").join(&siteid);
            let filename = directory.join(&iconid).with_extension("ico");
            create_dir_all(&directory).context("Failed to create icons directory")?;
            img.save(&filename).context("Failed to save icon")?;

            filename.display().to_string()
        }

        // TODO: Set up default PWA icon
        None => "".into(),
    };

    Ok(icon)
}

#[inline]
fn create_arp_entry(info: &SiteInfoInstall, exe: String, icon: String) -> Result<()> {
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(
            PathBuf::from(r"Software\Microsoft\Windows\CurrentVersion\Uninstall")
                .join(format!("FFPWA-{}", &info.id)),
        )
        .context("Failed to create registry key")?;

    key.set_value("UninstallString", &format!("{} site uninstall --quiet {}", &exe, &info.id))?;
    key.set_value("DisplayIcon", &icon)?;
    key.set_value("DisplayName", &info.name)?;
    key.set_value("Publisher", &info.domain)?;
    key.set_value("URLInfoAbout", &info.url)?;
    key.set_value("NoModify", &1u32)?;
    key.set_value("NoRepair", &1u32)?;
    key.set_value("Comments", &"Installed using FirefoxPWA")?;

    Ok(())
}

#[inline]
fn create_menu_shortcut(info: &SiteInfoInstall, exe: String, icon: String) -> Result<()> {
    unsafe {
        // We need to limit the name and description to prevent overflows
        let name: String = info.name.chars().take(60).collect();
        let description: String = info.description.chars().take(240).collect();

        // Set general shortcut properties
        let link: IShellLinkW = windows::create_instance(&ShellLink)?;
        link.SetPath(exe).ok()?;
        link.SetArguments(format!("site launch {}", info.id)).ok()?;
        link.SetDescription(description).ok()?;
        link.SetIconLocation(icon, 0).ok()?;
        link.SetShowCmd(7).ok()?;

        // Set AppUserModelID property
        let store: IPropertyStore = link.cast()?;
        let mut param: Param<PWSTR> = format!("filips.firefoxpwa.{}", info.id).into_param();
        let mut variant: PROPVARIANT = std::mem::zeroed();

        InitPropVariantFromStringVector(&mut param.abi(), 1, &mut variant).ok()?;

        store
            .SetValue(
                &PROPERTYKEY { fmtid: Guid::from("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid: 5 },
                &variant,
            )
            .ok()?;
        store.Commit().ok()?;

        // Save shortcut to file
        let path = directories::BaseDirs::new()
            .context("Failed to determine base system directories")?
            .data_dir()
            .join(r"Microsoft\Windows\Start Menu\Programs")
            .join(name)
            .with_extension("lnk");
        let path = path.display().to_string();

        let persist: IPersistFile = link.cast()?;
        persist.Save(path, true).ok()?;
    };

    Ok(())
}

#[inline]
fn create_jump_list_tasks(info: &SiteInfoInstall, dirs: &ProjectDirs, exe: String) -> Result<()> {
    unsafe {
        let appid = format!("filips.firefoxpwa.{}", info.id);

        // Create jump list and set its app ID and number of tasks
        let list: ICustomDestinationList = windows::create_instance(&DestinationList)?;

        if info.shortcuts.is_empty() {
            list.DeleteList(appid).ok()?;
            return Ok(());
        } else {
            list.SetAppID(appid.clone()).ok()?;
            let _: IObjectArray = list.BeginList(&mut (info.shortcuts.len() as u32))?;
        }

        // Create task collection and add tasks
        let collection: IObjectCollection = windows::create_instance(&EnumerableObjectCollection)?;

        for (i, shortcut) in info.shortcuts.iter().enumerate() {
            let url: Url =
                shortcut.url.clone().try_into().context("Failed to convert shortcut URL")?;

            let description = if let Some(description) = &shortcut.description {
                description.clone()
            } else {
                "".into()
            };

            let icon =
                store_icon(&info.id, &format!("shortcut{}", i), &shortcut.icons, &dirs, true)
                    .context("Failed to process and store shortcut icon")?;

            // Set general shortcut properties
            let link: IShellLinkW = windows::create_instance(&ShellLink)?;
            link.SetPath(exe.clone()).ok()?;
            link.SetArguments(format!("site launch {} --url {}", info.id, url)).ok()?;
            link.SetDescription(description).ok()?;
            link.SetIconLocation(icon, 0).ok()?;
            link.SetShowCmd(7).ok()?;

            let store: IPropertyStore = link.cast()?;

            // Set AppUserModelID property
            {
                let mut param: Param<PWSTR> = appid.clone().into_param();
                let mut variant: PROPVARIANT = std::mem::zeroed();

                InitPropVariantFromStringVector(&mut param.abi(), 1, &mut variant).ok()?;

                store
                    .SetValue(
                        &PROPERTYKEY {
                            fmtid: Guid::from("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),
                            pid: 5,
                        },
                        &variant,
                    )
                    .ok()?;
            }

            // Set SystemTitle property
            {
                let mut param: Param<PWSTR> = shortcut.name.clone().into_param();
                let mut variant: PROPVARIANT = std::mem::zeroed();

                InitPropVariantFromStringVector(&mut param.abi(), 1, &mut variant).ok()?;

                store
                    .SetValue(
                        &PROPERTYKEY {
                            fmtid: Guid::from("F29F85E0-4FF9-1068-AB91-08002B27B3D9"),
                            pid: 2,
                        },
                        &variant,
                    )
                    .ok()?;
            }

            store.Commit().ok()?;
            collection.AddObject(link).ok()?;
        }

        let tasks: IObjectArray = collection.cast()?;
        list.AddUserTasks(&tasks).ok()?;
        list.CommitList().ok()?;
    }

    Ok(())
}

pub fn install(info: &SiteInfoInstall, dirs: &ProjectDirs) -> Result<()> {
    let _ = remove_dir_all(dirs.data.join("icons").join(&info.id));

    let exe = dirs.install.join("firefoxpwa.exe").display().to_string();
    let icon = store_icon(&info.id, &"site", &info.icons, &dirs, false)
        .context("Failed to process and store site icon")?;

    windows::initialize_mta()?;

    create_arp_entry(&info, exe.clone(), icon.clone()).context("Failed to create ARP entry")?;
    create_menu_shortcut(&info, exe.clone(), icon).context("Failed to create menu shortcut")?;
    create_jump_list_tasks(&info, &dirs, exe).context("Failed to create jump list tasks")?;

    Ok(())
}

pub fn uninstall(info: &SiteInfoUninstall, dirs: &ProjectDirs) -> Result<()> {
    // Shortcut name is limited to prevent overflows
    let name: String = info.name.chars().take(60).collect();

    // Remove icons
    let icon = dirs.data.join("icons").join(&info.id);
    let _ = remove_dir_all(icon);

    // Remove ARP entry
    let _ = RegKey::predef(HKEY_CURRENT_USER).delete_subkey_all(
        PathBuf::from(r"Software\Microsoft\Windows\CurrentVersion\Uninstall")
            .join(format!("FFPWA-{}", &info.id)),
    );

    // Remove start menu shortcut
    let shortcut = PathBuf::from(std::env::var("AppData")?)
        .join(r"Microsoft\Windows\Start Menu\Programs")
        .join(name)
        .with_extension("lnk");
    let _ = remove_file(shortcut);

    // Remove jump list tasks
    unsafe {
        windows::initialize_mta()?;
        let list: ICustomDestinationList = windows::create_instance(&DestinationList)?;
        list.DeleteList(format!("filips.firefoxpwa.{}", info.id)).ok()?;
    }

    Ok(())
}
