use anyhow::Result;
use cfg_if::cfg_if;

use crate::directories::ProjectDirs;
use crate::integrations::{SiteInfoInstall, SiteInfoUninstall};

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "linux")]
mod linux;

#[cfg(target_os = "macos")]
mod macos;

#[inline]
pub fn install(info: &SiteInfoInstall, dirs: &ProjectDirs) -> Result<()> {
    cfg_if! {
        if #[cfg(target_os = "windows")] {
            windows::install(info, dirs)
        } else if #[cfg(target_os = "linux")] {
            linux::install(info, dirs)
        } else if #[cfg(target_os = "macos")] {
            macos::install(info, dirs)
        } else {
            compile_error!("Unknown operating system");
        }
    }
}

#[inline]
pub fn uninstall(info: &SiteInfoUninstall, dirs: &ProjectDirs) -> Result<()> {
    cfg_if! {
        if #[cfg(target_os = "windows")] {
            windows::uninstall(info, dirs)
        } else if #[cfg(target_os = "linux")] {
            linux::uninstall(info, dirs)
        } else if #[cfg(target_os = "macos")] {
            macos::uninstall(info, dirs)
        } else {
            compile_error!("Unknown operating system");
        }
    }
}

#[cfg(target_os = "macos")]
#[inline]
pub fn launch(site: &Site, url: &Option<Url>, arguments: &[String]) -> Result<()> {
    macos::launch(site, url, arguments)
}
