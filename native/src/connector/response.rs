use std::collections::BTreeMap;

use serde::Serialize;
use ulid::Ulid;

use crate::components::profile::Profile;
use crate::components::site::Site;
use crate::storage::Config;

/// TODO: Docs
#[derive(Serialize, Debug, PartialEq, Clone)]
#[serde(tag = "type", content = "data")]
pub enum ConnectorResponse {
    /// Versions of the installed system components.
    SystemVersions {
        /// Version of the PWAsForFirefox native program.
        ///
        /// Always set. When using a development version,
        /// commonly set to `0.0.0`.
        firefoxpwa: Option<String>,

        /// Version of the Firefox runtime.
        ///
        /// Only set if the runtime is installed.
        firefox: Option<String>,

        /// Version of the 7-Zip program.
        ///
        /// Only set on Windows, and if 7-Zip is installed.
        /// May also be `0.0.0` if 7-Zip was located through
        /// the `PATH` environment variable.
        _7zip: Option<String>,
    },

    /// Config of the native program.
    Config(Config),

    /// Config of the native program has been set.
    ConfigSet,

    /// Runtime has been installed.
    RuntimeInstalled,

    /// Runtime has been uninstalled.
    RuntimeUninstalled,

    /// List of all installed web apps.
    SiteList(BTreeMap<Ulid, Site>),

    /// Web app has been launched.
    SiteLaunched,

    /// Web app has been installed.
    SiteInstalled(Ulid),

    /// Web app has been uninstalled.
    SiteUninstalled,

    /// Web app has been updated.
    SiteUpdated,

    /// All web apps have been updated.
    AllSitesUpdated,

    /// List of all available profiles.
    ProfileList(BTreeMap<Ulid, Profile>),

    /// Profile has been created.
    ProfileCreated(Ulid),

    /// Profile has been removed.
    ProfileRemoved,

    /// Profile has been updated.
    ProfileUpdated,

    /// Protocol handler has been registered.
    ProtocolHandlerRegistered,

    /// Protocol handler has been unregistered.
    ProtocolHandlerUnregistered,

    /// Something went wrong...
    Error(String),
}
