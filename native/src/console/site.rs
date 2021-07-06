use std::io;
use std::io::Write;

use anyhow::{bail, Context, Result};
use log::{info, warn};
use ulid::Ulid;

use crate::components::runtime::Runtime;
use crate::components::site::{Site, SiteConfig};
use crate::console::app::{
    SiteInstallCommand,
    SiteLaunchCommand,
    SiteUninstallCommand,
    SiteUpdateCommand,
};
use crate::console::Run;
use crate::directories::ProjectDirs;
use crate::storage::Storage;

impl Run for SiteLaunchCommand {
    fn run(&self) -> Result<()> {
        let dirs = ProjectDirs::new()?;
        let runtime = Runtime::new(&dirs)?;
        let storage = Storage::load(&dirs)?;

        if runtime.version.is_none() {
            bail!("Runtime not installed");
        }

        let site = storage.sites.get(&self.id).context("Site does not exist")?;
        let profile = storage.profiles.get(&site.profile).context("Site without a profile")?;

        runtime.patch(&dirs)?;
        profile.patch(&dirs)?;

        info!("Launching the site");
        site.launch(&dirs, &runtime, &self.url)?;

        info!("Site launched!");
        Ok(())
    }
}

impl Run for SiteInstallCommand {
    fn run(&self) -> Result<()> {
        self._run()?;
        Ok(())
    }
}

impl SiteInstallCommand {
    pub fn _run(&self) -> Result<Ulid> {
        if self.manifest_url.scheme() == "data" && self.document_url.is_none() {
            bail!("The document URL is required when the manifest URL is a data URL");
        }

        let dirs = ProjectDirs::new()?;
        let mut storage = Storage::load(&dirs)?;

        let profile = storage
            .profiles
            .get_mut(&self.profile.unwrap_or_else(Ulid::nil))
            .context("Profile does not exist")?;

        info!("Installing the site");

        let config = SiteConfig {
            name: self.name.clone(),
            description: self.description.clone(),
            categories: self.categories.clone(),
            keywords: self.keywords.clone(),
            document_url: match &self.document_url {
                Some(url) => url.clone(),
                None => self.manifest_url.join(".")?,
            },
            manifest_url: self.manifest_url.clone(),
            start_url: self.start_url.clone(),
        };
        let site = Site::new(profile.ulid, config)?;
        let ulid = site.ulid;

        if self.system_integration {
            site.install_system_integration(&dirs)
                .context("Failed to install system integration")?;
        }

        profile.sites.push(ulid);
        storage.sites.insert(ulid, site);
        storage.write(&dirs)?;

        info!("Installed the site: {}", ulid);
        Ok(ulid)
    }
}

impl Run for SiteUninstallCommand {
    fn run(&self) -> Result<()> {
        let dirs = ProjectDirs::new()?;
        let mut storage = Storage::load(&dirs)?;

        let site = storage.sites.get(&self.id).context("Site does not exist")?;

        if !self.quiet {
            warn!("This will remove the site");
            warn!("Data will NOT be removed, remove them from the browser");

            print!("Do you want to continue (y/n)? ");
            io::stdout().flush()?;

            let mut confirm = String::new();
            io::stdin().read_line(&mut confirm)?;
            confirm = confirm.trim().into();

            if confirm != "Y" && confirm != "y" {
                info!("Aborting!");
                return Ok(());
            }
        }

        info!("Uninstalling the site");
        storage
            .profiles
            .get_mut(&site.profile)
            .context("Site with invalid profile")?
            .sites
            .retain(|id| *id != self.id);
        let site = storage.sites.remove(&self.id);

        if let Some(site) = site {
            site.uninstall_system_integration(&dirs)
                .context("Failed to uninstall system integration")?;
        }

        storage.write(&dirs)?;

        info!("Site uninstalled!");
        Ok(())
    }
}

impl Run for SiteUpdateCommand {
    fn run(&self) -> Result<()> {
        let dirs = ProjectDirs::new()?;
        let mut storage = Storage::load(&dirs)?;

        let site = storage.sites.get_mut(&self.id).context("Site does not exist")?;

        info!("Updating the site");
        if self.name.is_some() || self.store_none_values {
            site.config.name = self.name.clone();
        }
        if self.description.is_some() || self.store_none_values {
            site.config.description = self.description.clone();
        }
        if self.start_url.is_some() || self.store_none_values {
            site.config.start_url = self.start_url.clone();
        }
        if !self.categories.is_empty() || self.store_none_values {
            site.config.categories = self.categories.clone();
        }
        if !self.keywords.is_empty() || self.store_none_values {
            site.config.keywords = self.keywords.clone();
        }
        site.update()?;

        if self.system_integration {
            site.install_system_integration(&dirs)
                .context("Failed to update system integration")?;
        }

        storage.write(&dirs)?;

        info!("Site updated!");
        Ok(())
    }
}
