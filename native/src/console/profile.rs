use std::fs::remove_dir_all;
use std::io;
use std::io::Write;

use anyhow::{Context, Result};
use log::{info, warn};

use crate::components::profile::Profile;
use crate::console::app::{
    ProfileCreateCommand,
    ProfileListCommand,
    ProfileRemoveCommand,
    ProfileUpdateCommand,
};
use crate::console::Run;
use crate::directories::ProjectDirs;
use crate::storage::Storage;

impl Run for ProfileListCommand {
    fn run(&self) -> Result<()> {
        let dirs = ProjectDirs::new()?;
        let storage = Storage::load(&dirs)?;

        for (_, profile) in storage.profiles {
            println!(
                "{:=^60}\nDescription: {}\nID: {}",
                format!(" {} ", profile.name.unwrap_or_else(|| "* Unnamed *".into())),
                profile.description.unwrap_or_else(|| "* Nothing *".into()),
                profile.ulid
            );

            if !profile.sites.is_empty() {
                println!("\nSites:");
            }
            for site in profile.sites {
                let site = storage.sites.get(&site).context("Profile with invalid site")?;

                let name = site.config.name.clone().unwrap_or_else(|| {
                    site.manifest.name.clone().unwrap_or_else(|| "Unnamed".into())
                });

                println!("- {}: {} ({})", name, site.config.manifest_url, site.ulid);
            }

            println!();
        }

        Ok(())
    }
}

impl Run for ProfileCreateCommand {
    fn run(&self) -> Result<()> {
        let dirs = ProjectDirs::new()?;
        let mut storage = Storage::load(&dirs)?;

        info!("Creating the profile");

        let profile = Profile::new(self.name.clone(), self.description.clone());
        let ulid = profile.ulid;

        storage.profiles.insert(ulid, profile);
        storage.write(&dirs)?;

        info!("Created a new profile: {}", ulid);
        Ok(())
    }
}

impl Run for ProfileRemoveCommand {
    fn run(&self) -> Result<()> {
        let dirs = ProjectDirs::new()?;
        let mut storage = Storage::load(&dirs)?;

        let profile = storage.profiles.get_mut(&self.id).context("Profile does not exist")?;

        if !self.quiet {
            warn!("This will completely remove the profile and all associated sites, including their data");
            warn!("You might not be able to fully recover this action");

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

        if profile.default {
            warn!("Default profile cannot be completely removed");
            warn!("Sites and data will be cleared, but the profile will stay");
        }

        info!("Removing directories");
        let _ = remove_dir_all(dirs.data.join("profiles").join(self.id.to_string()));

        info!("Removing sites");
        for site in &profile.sites {
            storage.sites.remove(site);
        }

        if !profile.default {
            info!("Removing the profile");
            storage.profiles.remove(&self.id);
        } else {
            profile.sites.clear();
        }

        storage.write(&dirs)?;

        info!("Profile removed!");
        Ok(())
    }
}

impl Run for ProfileUpdateCommand {
    fn run(&self) -> Result<()> {
        let dirs = ProjectDirs::new()?;
        let mut storage = Storage::load(&dirs)?;

        let profile = storage.profiles.get_mut(&self.id).context("Profile does not exist")?;

        info!("Updating the profile");
        if self.name.is_some() {
            profile.name = self.name.clone();
        }
        if self.description.is_some() {
            profile.description = self.description.clone();
        }

        storage.write(&dirs)?;

        info!("Profile updated!");
        Ok(())
    }
}
