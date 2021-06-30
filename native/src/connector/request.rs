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
    UpdateSite(Ulid),
}
