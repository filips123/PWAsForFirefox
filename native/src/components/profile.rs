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
    /// A profile ID.
    ///
    /// Stored as the ULID format. Unique for each profile
    /// and auto-generated when a profile is created.
    ///
    /// One profile with zero/nil ULID always exists and is treated
    /// as a default profile for all web apps. This profile cannot
    /// be completely removed. When trying to remove it, web apps
    /// and data will be cleared, but the profile will stay.
    pub ulid: Ulid,

    /// A profile name.
    pub name: Option<String>,

    /// A profile description.
    pub description: Option<String>,

    /// A list of web app IDs installed within this profile.
    #[serde(default)]
    pub sites: Vec<Ulid>,
}

impl Default for Profile {
    #[inline]
    fn default() -> Self {
        Self {
            ulid: Ulid::nil(),
            name: Some("Default".into()),
            description: Some("Default profile for all web apps".into()),
            sites: vec![],
        }
    }
}

impl Profile {
    #[inline]
    pub fn new(name: Option<String>, description: Option<String>) -> Self {
        Self { ulid: Ulid::new(), name, description, sites: vec![] }
    }

    pub fn patch(&self, dirs: &ProjectDirs) -> Result<()> {
        let source = dirs.sysdata.join("userchrome/profile");
        let profile = dirs.userdata.join("profiles").join(self.ulid.to_string());

        let mut options = CopyOptions::new();
        options.content_only = true;
        options.overwrite = true;

        if !profile.exists() {
            info!("Creating a profile directory");
            create_dir_all(&profile).context("Failed to create a profile directory")?;
        }

        info!("Patching the profile");
        let _ = remove_dir_all(&profile.join("startupCache"));
        let _ = remove_dir_all(&profile.join("chrome/pwa"));
        copy(&source, &profile, &options).context("Failed to patch the profile")?;

        info!("Profile patched!");
        Ok(())
    }
}
