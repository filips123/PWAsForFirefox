use reqwest::blocking::Client;

use crate::components::site::Site;
use crate::directories::ProjectDirs;

#[cfg(any(target_os = "linux", target_os = "macos"))]
mod categories;
mod implementation;
mod utils;

#[cfg(target_os = "macos")]
pub use implementation::launch;
pub use implementation::{install, uninstall};

#[derive(Debug, Clone)]
pub struct IntegrationInstallArgs<'a> {
    pub site: &'a Site,
    pub dirs: &'a ProjectDirs,
    pub client: Option<&'a Client>,
    pub update_manifest: bool,
    pub update_icons: bool,
    pub old_name: Option<&'a str>,
}

#[derive(Debug, Clone)]
pub struct IntegrationUninstallArgs<'a> {
    pub site: &'a Site,
    pub dirs: &'a ProjectDirs,
}
