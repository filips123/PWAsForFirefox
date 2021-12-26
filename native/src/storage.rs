use std::collections::BTreeMap;
use std::fs::File;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use smart_default::SmartDefault;
use ulid::Ulid;

use crate::components::profile::Profile;
use crate::components::site::Site;
use crate::directories::ProjectDirs;

#[non_exhaustive]
#[derive(Serialize, Deserialize, Debug, Eq, PartialEq, Clone, SmartDefault)]
#[serde(default)]
pub struct Config {
    pub always_patch: bool,
    pub runtime_enable_wayland: bool,
    pub runtime_use_xinput2: bool,
    pub runtime_use_portals: bool,
}

#[non_exhaustive]
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone, SmartDefault)]
#[serde(default)]
pub struct Storage {
    #[default([(Ulid::nil(), Profile::default())].iter().cloned().collect())]
    pub profiles: BTreeMap<Ulid, Profile>,
    pub sites: BTreeMap<Ulid, Site>,
    pub arguments: Vec<String>,
    pub variables: BTreeMap<String, String>,
    pub config: Config,
}

impl Storage {
    pub fn load(dirs: &ProjectDirs) -> Result<Self> {
        let filename = dirs.userdata.join("config.json");

        if !filename.exists() {
            return Ok(Self::default());
        }

        let file = File::open(filename).context("Failed to open storage")?;
        serde_json::from_reader(file).context("Failed to load storage")
    }

    pub fn write(&self, dirs: &ProjectDirs) -> Result<()> {
        let filename = dirs.userdata.join("config.json");
        let file = File::create(filename).context("Failed to open storage")?;

        if cfg!(debug_assertions) {
            serde_json::to_writer_pretty(file, &self).context("Failed to write storage")
        } else {
            serde_json::to_writer(file, &self).context("Failed to write storage")
        }
    }
}
