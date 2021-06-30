#![allow(clippy::large_enum_variant)]

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
#[serde(tag = "type", content = "data")]
pub enum ResponseMessage {
    /// The versions of the installed system components.
    SystemVersions { firefoxpwa: Option<String>, firefox: Option<String>, _7zip: Option<String> },

    /// Runtime has been successfully installed.
    RuntimeInstalled,

    /// Runtime has been successfully uninstalled.
    RuntimeUninstalled,

    /// Site has been successfully installed.
    SiteInstalled,

    /// Site has been successfully uninstalled.
    SiteUninstalled,

    /// Site has been successfully updated.
    SiteUpdated,
}
