use anyhow::{Context, Result};

use crate::components::runtime::Runtime;
use crate::console::app::{RuntimeInstallCommand, RuntimePatchCommand, RuntimeUninstallCommand};
use crate::console::Run;
use crate::directories::ProjectDirs;

impl Run for RuntimeInstallCommand {
    #[cfg(not(feature = "immutable-runtime"))]
    fn run(&self) -> Result<()> {
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
