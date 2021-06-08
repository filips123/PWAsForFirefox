use anyhow::{Context, Result};
use cfg_if::cfg_if;

use crate::components::runtime::Runtime;
use crate::console::app::{RuntimeInstallCommand, RuntimeUninstallCommand};
use crate::console::Run;
use crate::directories::ProjectDirs;

impl Run for RuntimeInstallCommand {
    fn run(&self) -> Result<()> {
        cfg_if! {
            if #[cfg(target_os = "windows")] {
                use log::warn;
                use crate::components::_7zip::_7Zip;

                let _7zip = _7Zip::new()?;
                if _7zip.version.is_none() {
                    warn!("7-Zip is currently not installed and will be installed automatically");
                    warn!("You can remove it manually after the runtime is installed");
                    _7zip.install().context("Failed to install 7-Zip")?;
                }
            }
        }

        let dirs = ProjectDirs::new()?;
        let runtime = Runtime::new(&dirs)?;

        runtime.install().context("Failed to install runtime")
    }
}

impl Run for RuntimeUninstallCommand {
    fn run(&self) -> Result<()> {
        let dirs = ProjectDirs::new()?;
        let runtime = Runtime::new(&dirs)?;

        runtime.uninstall().context("Failed to uninstall runtime")
    }
}
