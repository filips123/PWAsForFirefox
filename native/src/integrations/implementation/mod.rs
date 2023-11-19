use anyhow::Result;
use cfg_if::cfg_if;

#[rustfmt::skip]
#[cfg(platform_macos)]
use {crate::components::site::Site, std::process::Child, url::Url};

use crate::integrations::{IntegrationInstallArgs, IntegrationUninstallArgs};

#[cfg(all(platform_windows, not(feature = "portable")))]
mod windows;

#[cfg(any(platform_linux, platform_bsd))]
mod linux;

#[cfg(platform_macos)]
mod macos;

#[cfg(all(platform_windows, feature = "portable"))]
mod portableapps;

#[inline]
pub fn install(args: &IntegrationInstallArgs) -> Result<()> {
    cfg_if! {
        if #[cfg(all(platform_windows, not(feature = "portable")))] {
            windows::install(args)
        } else if #[cfg(all(platform_windows, feature = "portable"))] {
            portableapps::install(args)
        } else if #[cfg(any(platform_linux, platform_bsd))] {
            linux::install(args)
        } else if #[cfg(platform_macos)] {
            macos::install(args)
        } else {
            compile_error!("Unknown operating system");
        }
    }
}

#[inline]
pub fn uninstall(args: &IntegrationUninstallArgs) -> Result<()> {
    cfg_if! {
        if #[cfg(all(platform_windows, not(feature = "portable")))] {
            windows::uninstall(args)
        } else if #[cfg(all(platform_windows, feature = "portable"))] {
            portableapps::uninstall(args)
       } else if #[cfg(any(platform_linux, platform_bsd))] {
            linux::uninstall(args)
        } else if #[cfg(platform_macos)] {
            macos::uninstall(args)
        } else {
            compile_error!("Unknown operating system");
        }
    }
}

#[cfg(platform_macos)]
#[inline]
pub fn launch(site: &Site, urls: &[Url], arguments: &[String]) -> Result<Child> {
    macos::launch(site, urls, arguments)
}
