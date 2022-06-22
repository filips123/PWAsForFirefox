use anyhow::Result;
use cfg_if::cfg_if;

#[rustfmt::skip]
#[cfg(target_os = "macos")]
use {crate::components::site::Site, std::process::Child, url::Url};

use crate::integrations::{IntegrationInstallArgs, IntegrationUninstallArgs};

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "linux")]
mod linux;

#[cfg(target_os = "macos")]
mod macos;

#[inline]
pub fn install(args: &IntegrationInstallArgs) -> Result<()> {
    cfg_if! {
        if #[cfg(target_os = "windows")] {
            windows::install(args)
        } else if #[cfg(target_os = "linux")] {
            linux::install(args)
        } else if #[cfg(target_os = "macos")] {
            macos::install(args)
        } else {
            compile_error!("Unknown operating system");
        }
    }
}

#[inline]
pub fn uninstall(args: &IntegrationUninstallArgs) -> Result<()> {
    cfg_if! {
        if #[cfg(target_os = "windows")] {
            windows::uninstall(args)
        } else if #[cfg(target_os = "linux")] {
            linux::uninstall(args)
        } else if #[cfg(target_os = "macos")] {
            macos::uninstall(args)
        } else {
            compile_error!("Unknown operating system");
        }
    }
}

#[cfg(target_os = "macos")]
#[inline]
pub fn launch(site: &Site, url: &Option<Url>, arguments: &[String]) -> Result<Child> {
    macos::launch(site, url, arguments)
}
