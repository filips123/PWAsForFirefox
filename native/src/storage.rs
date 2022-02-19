use std::collections::BTreeMap;
use std::fs::File;
use std::io::{BufReader, BufWriter, Read};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use smart_default::SmartDefault;
use ulid::Ulid;

use crate::components::profile::Profile;
use crate::components::site::Site;
use crate::directories::ProjectDirs;

const STORAGE_OPEN_ERROR: &str = "Failed to open storage";
const STORAGE_LOAD_ERROR: &str = "Failed to load storage";
const STORAGE_SAVE_ERROR: &str = "Failed to save storage";

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

        let file = File::open(filename).context(STORAGE_OPEN_ERROR)?;
        let mut reader = BufReader::new(file);
        let mut data = String::new();

        reader.read_to_string(&mut data).context(STORAGE_LOAD_ERROR)?;
        serde_json::from_str(&data).context(STORAGE_LOAD_ERROR)
    }

    pub fn write(&self, dirs: &ProjectDirs) -> Result<()> {
        let filename = dirs.userdata.join("config.json");
        let file = File::create(filename).context(STORAGE_OPEN_ERROR)?;
        let writer = BufWriter::new(file);

        if cfg!(debug_assertions) {
            serde_json::to_writer_pretty(writer, &self).context(STORAGE_SAVE_ERROR)
        } else {
            serde_json::to_writer(writer, &self).context(STORAGE_SAVE_ERROR)
        }
    }
}
