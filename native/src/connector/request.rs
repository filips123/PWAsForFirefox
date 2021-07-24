#![allow(clippy::large_enum_variant)]

use serde::{Deserialize, Serialize};
use ulid::Ulid;
use url::Url;

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
#[serde(tag = "cmd", content = "params")]
pub enum RequestMessage {
    /// Gets the versions of the installed system components.
    GetSystemVersions,

    /// Installs the browser runtime.
    InstallRuntime,

    /// Uninstalls the browser runtime.
    UninstallRuntime,

    /// Lists all installed sites.
    GetSiteList,

    /// Launches the site by its ULID at the optional URL.
    LaunchSite { id: Ulid, url: Option<Url> },

    /// Installs the site from the manifest with optional user overwrites.
    InstallSite {
        manifest_url: Url,
        document_url: Option<Url>,
        start_url: Option<Url>,
        profile: Option<Ulid>,
        name: Option<String>,
        description: Option<String>,
        categories: Vec<String>,
        keywords: Vec<String>,
    },

    /// Uninstalls the site by its ULID.
    UninstallSite(Ulid),

    /// Updates the site by its ULID with optional user overwrites.
    UpdateSite {
        id: Ulid,
        start_url: Option<Url>,
        name: Option<String>,
        description: Option<String>,
        categories: Vec<String>,
        keywords: Vec<String>,
    },

    /// Lists all available profiles.
    GetProfileList,

    /// Creates a new profile with a name and description.
    CreateProfile { name: Option<String>, description: Option<String> },

    /// Removes an existing profile by its ULID.
    RemoveProfile(Ulid),

    /// Updates an existing profile by its ULID with a new name and description.
    UpdateProfile { id: Ulid, name: Option<String>, description: Option<String> },
}
