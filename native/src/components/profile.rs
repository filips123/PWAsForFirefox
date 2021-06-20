use std::fs::{create_dir_all, remove_dir_all};

use anyhow::{Context, Result};
use fs_extra::dir::{copy, CopyOptions};
use log::info;
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use crate::directories::ProjectDirs;

#[non_exhaustive]
#[derive(Serialize, Deserialize, Debug, Eq, PartialEq, Clone)]
pub struct Profile {
    pub ulid: Ulid,

    pub name: Option<String>,
    pub description: Option<String>,
    pub default: bool,

    #[serde(default)]
    pub sites: Vec<Ulid>,
}

impl Default for Profile {
    #[inline]
    fn default() -> Self {
        Self {
            ulid: Ulid::nil(),
            name: Some("Default".into()),
            description: Some("Default profile for all sites".into()),
            default: true,
            sites: vec![],
        }
    }
}

impl Profile {
    #[inline]
    pub fn new(name: Option<String>, description: Option<String>) -> Self {
        Self { ulid: Ulid::new(), name, description, default: false, sites: vec![] }
    }

    pub fn patch(&self, dirs: &ProjectDirs) -> Result<()> {
        let source = dirs.install.join("userchrome/profile");
        let profile = dirs.data.join("profiles").join(self.ulid.to_string());

        let mut options = CopyOptions::new();
        options.content_only = true;
        options.overwrite = true;

        if !profile.exists() {
            info!("Creating the profile directory");
            create_dir_all(&profile).context("Failed to create the profile")?;
        }

        info!("Patching the profile");
        let _ = remove_dir_all(&profile.join("startupCache"));
        let _ = remove_dir_all(&profile.join("chrome/pwa"));
        copy(&source, &profile, &options).context("Failed to patch the profile")?;

        info!("Profile patched!");
        Ok(())
    }
}
