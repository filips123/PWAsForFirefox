use anyhow::{Context, Result};
use cfg_if::cfg_if;

use crate::components::runtime::Runtime;
use crate::console::app::{RuntimeInstallCommand, RuntimePatchCommand, RuntimeUninstallCommand};
use crate::console::Run;
use crate::directories::ProjectDirs;

impl Run for RuntimeInstallCommand {
    #[cfg(not(feature = "immutable-runtime"))]
    fn run(&self) -> Result<()> {
        cfg_if! {
            if #[cfg(platform_windows)] {
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
        runtime.install().context("Failed to install runtime")?;

        let runtime = Runtime::new(&dirs)?;
        runtime.patch(&dirs, None)?;

        Ok(())
    }

    #[cfg(feature = "immutable-runtime")]
    fn run(&self) -> Result<()> {
        anyhow::bail!("Cannot install runtime when the immutable runtime feature is enabled")
    }
}

impl Run for RuntimeUninstallCommand {
    #[cfg(not(feature = "immutable-runtime"))]
    fn run(&self) -> Result<()> {
        let dirs = ProjectDirs::new()?;
        let runtime = Runtime::new(&dirs)?;

        runtime.uninstall().context("Failed to uninstall runtime")
    }

    #[cfg(feature = "immutable-runtime")]
    fn run(&self) -> Result<()> {
        anyhow::bail!("Cannot uninstall runtime when the immutable runtime feature is enabled")
    }
}

impl Run for RuntimePatchCommand {
    fn run(&self) -> Result<()> {
        let dirs = ProjectDirs::new()?;
        let runtime = Runtime::new(&dirs)?;
        runtime.patch(&dirs, None)
    }
}
