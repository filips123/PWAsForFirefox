use std::fs::metadata;
use std::io;
use std::io::Write;

use anyhow::{bail, Context, Result};
use cfg_if::cfg_if;
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
use crate::console::{store_value, store_value_vec, Run};
use crate::directories::ProjectDirs;
use crate::storage::Storage;

impl Run for SiteLaunchCommand {
    fn run(&self) -> Result<()> {
        let dirs = ProjectDirs::new()?;
        let storage = Storage::load(&dirs)?;

        let site = storage.sites.get(&self.id).context("Web app does not exist")?;
        let args = if !&self.arguments.is_empty() { &self.arguments } else { &storage.arguments };

        cfg_if! {
            if #[cfg(target_os = "macos")] {
                use crate::integrations;

                if !self.direct_launch {
                    integrations::launch(site, &self.url, args)?;
                    return Ok(())
                }
            }
        }

        let runtime = Runtime::new(&dirs)?;
        let profile = storage.profiles.get(&site.profile).context("Web app without a profile")?;

        if runtime.version.is_none() {
            bail!("Runtime not installed");
        }

        let should_patch = if storage.config.always_patch {
            // Force patching if this is enabled
            true
        } else {
            // Uses "chrome.jsm" file because it contains version info
            let source = dirs.sysdata.join("userchrome/profile/chrome/pwa/chrome.jsm");
            let target = dirs
                .userdata
                .join("profiles")
                .join(profile.ulid.to_string())
                .join("chrome/pwa/chrome.jsm");

            // Only patch if modification dates of source and target are different
            // In case any error happens, just force patching
            if let (Ok(source), Ok(target)) = (metadata(source), metadata(target)) {
                if let (Ok(source), Ok(target)) = (source.modified(), target.modified()) {
                    source > target
                } else {
                    true
                }
            } else {
                true
            }
        };

        // Patching on macOS is always needed to correctly show the web app name
        // Otherwise, patch runtime and profile only if needed
        if cfg!(target_os = "macos") || should_patch {
            runtime.patch(&dirs, site)?;
            profile.patch(&dirs)?;
        }

        info!("Launching the web app");
        cfg_if! {
            if #[cfg(target_os = "macos")] {
                site.launch(&dirs, &runtime, &storage.config, &self.url, args, storage.variables)?.wait()?;
            } else {
                site.launch(&dirs, &runtime, &storage.config, &self.url, args, storage.variables)?;
            }
        }

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

        info!("Installing the web app");

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

        info!("Web app installed: {}", ulid);
        Ok(ulid)
    }
}

impl Run for SiteUninstallCommand {
    fn run(&self) -> Result<()> {
        let dirs = ProjectDirs::new()?;
        let mut storage = Storage::load(&dirs)?;

        let site = storage.sites.get(&self.id).context("Web app does not exist")?;

        if !self.quiet {
            warn!("This will remove the web app");
            warn!("Data will NOT be removed, remove them from the PWA browser");

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

        info!("Uninstalling the web app");
        storage
            .profiles
            .get_mut(&site.profile)
            .context("Web app with invalid profile")?
            .sites
            .retain(|id| *id != self.id);
        let site = storage.sites.remove(&self.id);

        if self.system_integration {
            if let Some(site) = site {
                site.uninstall_system_integration(&dirs)
                    .context("Failed to uninstall system integration")?;
            }
        }

        storage.write(&dirs)?;

        info!("Web app uninstalled!");
        Ok(())
    }
}

impl Run for SiteUpdateCommand {
    fn run(&self) -> Result<()> {
        let dirs = ProjectDirs::new()?;
        let mut storage = Storage::load(&dirs)?;

        let site = storage.sites.get_mut(&self.id).context("Web app does not exist")?;
        let old_name = site.name().unwrap_or_else(|| site.domain());

        info!("Updating the web app");
        store_value!(site.config.name, self.name);
        store_value!(site.config.description, self.description);
        store_value!(site.config.start_url, self.start_url);
        store_value_vec!(site.config.categories, self.categories);
        store_value_vec!(site.config.keywords, self.keywords);

        if self.update_manifest {
            site.update().context("Failed to update web app manifest")?;
        }

        if self.system_integration {
            site.update_system_integration(&dirs, old_name)
                .context("Failed to update system integration")?;
        }

        storage.write(&dirs)?;

        info!("Web app updated!");
        Ok(())
    }
}
