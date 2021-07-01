#![allow(clippy::large_enum_variant)]

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ulid::Ulid;

use crate::components::profile::Profile;
use crate::components::site::Site;

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
#[serde(tag = "type", content = "data")]
pub enum ResponseMessage {
    /// The versions of the installed system components.
    SystemVersions { firefoxpwa: Option<String>, firefox: Option<String>, _7zip: Option<String> },

    /// Runtime has been successfully installed.
    RuntimeInstalled,

    /// Runtime has been successfully uninstalled.
    RuntimeUninstalled,

    /// List of all installed sites.
    SiteList(BTreeMap<Ulid, Site>),

    /// Site has been successfully launched.
    SiteLaunched,

    /// Site has been successfully installed.
    SiteInstalled(Ulid),

    /// Site has been successfully uninstalled.
    SiteUninstalled,

    /// Site has been successfully updated.
    SiteUpdated,

    /// List of all available profiles.
    ProfileList(BTreeMap<Ulid, Profile>),

    /// Profile has been successfully created.
    ProfileCreated(Ulid),

    /// Profile has been successfully created.
    ProfileRemoved,

    /// Profile has been successfully updated.
    ProfileUpdated,
}
