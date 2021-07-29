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
use data_url::DataUrl;
use image::imageops::FilterType::Gaussian;
use image::GenericImageView;
use log::error;
use serde::de::Unexpected::Bytes;
use url::Url;
use web_app_manifest::resources::IconResource;
use web_app_manifest::types::{ImagePurpose, ImageSize};
use windows::{Guid, Interface, IntoParam, Param};
use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

use crate::directories::ProjectDirs;
use crate::integrations::{generate_icon, is_icon_supported, SiteInfoInstall, SiteInfoUninstall};

fn store_icon(
    siteid: &str,
    iconid: &str,
    name: &str,
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

        size1.cmp(size2)
    });

    // Get the first icon larger or equal to 256 (max ICO size), and if there is none, largest of all
    let icon = icons
        .iter()
        .find(|icon| {
            icon.sizes.iter().max() >= Some(&ImageSize::Fixed(256, 256)) && is_icon_supported(icon)
        })
        .or_else(|| icons.iter().rev().find(|icon| is_icon_supported(icon)));

    // Get the icon filename and directory
    let directory = dirs.userdata.join("icons").join(&siteid);
    let filename = directory.join(&iconid).with_extension("ico");

    // Convert the chosen icon into ICO and save it for usages in ARP page and start menu
    // Currently only one embedded image per ICO is supported: https://github.com/image-rs/image/issues/884
    let icon = match icon {
        Some(icon) => {
            // Download the image from the URL
            // Either download it from the network using request or decode it from a data URL
            let url: Url = icon.src.clone().try_into().context("Failed to convert icon URL")?;
            let bytes = if url.scheme() != "data" {
                let response = reqwest::blocking::get(url).context("Failed to download icon")?;
                response.bytes().context("Failed to read icon")?
            } else {
                let url =
                    DataUrl::process(url.as_str()).context("Failed to process icon data URL")?;
                let (body, _) = url.decode_to_vec().context("Failed to decode icon data URL")?;
                body.into()
            };
            let mut img = image::load_from_memory(&bytes).context("Failed to load icon")?;

            // Resize the image if needed
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

            // Save the image to a file
            create_dir_all(&directory).context("Failed to create icons directory")?;
            img.save(&filename).context("Failed to save icon")?;
            filename.display().to_string()
        }

        None => {
            // Generate icon from the first letter of the site/shortcut name
            let letter = name.chars().next().context("Failed to get first letter")?;
            create_dir_all(&directory).context("Failed to create icons directory")?;
            generate_icon(letter, 256, &filename).context("Failed to generate icon")?;
            filename.display().to_string()
        }
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
        // Limit the name and description to prevent overflows
        let mut name: String = info.name.chars().take(60).collect();
        let description: String = info.description.chars().take(240).collect();

        // Sanitize the name to prevent invalid filenames
        let pattern: &[_] = &['.', ' '];
        name = sanitize_filename::sanitize(name);
        name = name.trim_end_matches(pattern).into();
        name = sanitize_filename::sanitize(name);
        if name.is_empty() {
            name = format!("Site {}", info.id);
        }

        // Set general shortcut properties
        let link: IShellLinkW = windows::create_instance(&ShellLink)?;
        link.SetPath(exe)?;
        link.SetArguments(format!("site launch {}", info.id))?;
        link.SetDescription(description)?;
        link.SetIconLocation(icon, 0)?;
        link.SetShowCmd(7)?;

        // Set AppUserModelID property
        // https://docs.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-id
        let store: IPropertyStore = link.cast()?;
        let mut param: Param<PWSTR> = format!("filips.firefoxpwa.{}", info.id).into_param();
        let mut variant: PROPVARIANT = InitPropVariantFromStringVector(&mut param.abi(), 1)?;
        store.SetValue(
            &PROPERTYKEY { fmtid: Guid::from("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid: 5 },
            &variant,
        )?;
        store.Commit()?;

        // Save shortcut to file
        let path = directories::BaseDirs::new()
            .context("Failed to determine base system directories")?
            .data_dir()
            .join(r"Microsoft\Windows\Start Menu\Programs")
            .join(name)
            .with_extension("lnk");
        let path = path.display().to_string();

        let persist: IPersistFile = link.cast()?;
        persist.Save(path, true)?;
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
            list.DeleteList(appid)?;
            return Ok(());
        } else {
            list.SetAppID(appid.clone())?;
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

            let icon = store_icon(
                &info.id,
                &format!("shortcut{}", i),
                &shortcut.name,
                &shortcut.icons,
                dirs,
                true,
            )
            .context("Failed to process and store shortcut icon")
            .unwrap_or_else(|error| {
                // Shortcut icon is not important so much, so we can just log errors
                error!("{:?}", error);
                "".into()
            });

            // Set general shortcut properties
            let link: IShellLinkW = windows::create_instance(&ShellLink)?;
            link.SetPath(exe.clone())?;
            link.SetArguments(format!("site launch {} --url {}", info.id, url))?;
            link.SetDescription(description)?;
            link.SetIconLocation(icon, 0)?;
            link.SetShowCmd(7)?;

            let store: IPropertyStore = link.cast()?;

            // Set AppUserModelID property
            // https://docs.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-id
            {
                let mut param: Param<PWSTR> = appid.clone().into_param();
                let mut variant: PROPVARIANT =
                    InitPropVariantFromStringVector(&mut param.abi(), 1)?;

                store.SetValue(
                    &PROPERTYKEY {
                        fmtid: Guid::from("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),
                        pid: 5,
                    },
                    &variant,
                )?;
            }

            // Set SystemTitle property
            // https://docs.microsoft.com/en-us/windows/win32/properties/props-system-title
            {
                let mut param: Param<PWSTR> = shortcut.name.clone().into_param();
                let mut variant: PROPVARIANT =
                    InitPropVariantFromStringVector(&mut param.abi(), 1)?;

                store.SetValue(
                    &PROPERTYKEY {
                        fmtid: Guid::from("F29F85E0-4FF9-1068-AB91-08002B27B3D9"),
                        pid: 2,
                    },
                    &variant,
                )?;
            }

            store.Commit()?;
            collection.AddObject(link)?;
        }

        let tasks: IObjectArray = collection.cast()?;
        list.AddUserTasks(&tasks)?;
        list.CommitList()?;
    }

    Ok(())
}

pub fn install(info: &SiteInfoInstall, dirs: &ProjectDirs) -> Result<()> {
    let _ = remove_dir_all(dirs.userdata.join("icons").join(&info.id));

    let exe = dirs.executables.join("firefoxpwa.exe").display().to_string();
    let icon = store_icon(&info.id, "site", &info.name, info.icons, dirs, false)
        .context("Failed to process and store site icon")?;

    windows::initialize_mta()?;

    create_arp_entry(info, exe.clone(), icon.clone()).context("Failed to create ARP entry")?;
    create_menu_shortcut(info, exe.clone(), icon).context("Failed to create menu shortcut")?;
    create_jump_list_tasks(info, dirs, exe).context("Failed to create jump list tasks")?;

    Ok(())
}

pub fn uninstall(info: &SiteInfoUninstall, dirs: &ProjectDirs) -> Result<()> {
    // Shortcut name is limited to prevent overflows
    let mut name: String = info.name.chars().take(60).collect();

    // Shortcut name is sanitized to prevent invalid filenames
    let pattern: &[_] = &['.', ' '];
    name = sanitize_filename::sanitize(name);
    name = name.trim_end_matches(pattern).into();
    name = sanitize_filename::sanitize(name);
    if name.is_empty() {
        name = format!("Site {}", info.id);
    }

    // Remove icons
    let icon = dirs.userdata.join("icons").join(&info.id);
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
        list.DeleteList(format!("filips.firefoxpwa.{}", info.id))?;
    }

    Ok(())
}
