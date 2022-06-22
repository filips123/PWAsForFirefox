use anyhow::Result;
use serde::{Deserialize, Deserializer};
use ulid::Ulid;
use url::Url;

use crate::connector::response::ConnectorResponse;
use crate::storage::Config;

/// Builds a connector request enum for all supported request types.
macro_rules! build_request_enum {
    ($($(#[$attr:meta])* $msg:ident),* $(,)?) => {
        use crate::connector::Connection;
        use crate::connector::process::Process;

        /// TODO: Docs
        #[derive(Deserialize, Debug, Eq, PartialEq, Clone)]
        #[serde(tag = "cmd", content = "params")]
        pub enum ConnectorRequest {
            $(
                #[doc = concat!("Wrapper around [`", stringify!($msg), "`].")]
                $(#[$attr])*
                $msg($msg),
            )*
        }

        impl Process for ConnectorRequest {
            fn process(&self, connection: &Connection) -> Result<ConnectorResponse> {
                match self {
                    $(Self::$msg(msg) => msg.process(&connection),)*
                }
            }
        }
    };
}

/// Implements a custom deserializer for unit structs that ignores
/// their content to prevent failing deserialization when `null`
/// is not provided in the `params`.
macro_rules! deserialize_unit_struct {
    ($msg:ty) => {
        impl<'de> Deserialize<'de> for $msg {
            fn deserialize<D>(_deserializer: D) -> Result<Self, D::Error>
            where
                D: serde::de::Deserializer<'de>,
            {
                Ok(Self)
            }
        }
    };
}

/// Just a simple function that returns `true`.
///
/// Needed to set `true` as a default boolean value until
/// Serde adds support for literals as default values.
///
/// See: https://github.com/serde-rs/serde/issues/368
const fn default_as_true() -> bool {
    true
}

/// Supports "double option" pattern for update requests.
///
/// - Parses missing field as `None`.
/// - Parses field with value `None` as `Some(None)`.
/// - Parses field with set value as `Some(Some(value))`.
///
/// See: https://github.com/serde-rs/serde/issues/984
///      https://github.com/serde-rs/serde/issues/1042
fn double_option<'de, T, D>(de: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Deserialize::deserialize(de).map(Some)
}

/// Gets versions of the installed system components.
///
/// # Parameters
///
/// None.
///
/// # Returns
///
/// [`ConnectorResponse::SystemVersions`] - Versions of the installed system components.
///
#[derive(Debug, Eq, PartialEq, Clone)]
pub struct GetSystemVersions;

/// Gets config of the native program.
///
/// # Parameters
///
/// None.
///
/// # Returns
///
/// [`ConnectorResponse::Config`] - Config of the native program.
///
#[derive(Debug, Eq, PartialEq, Clone)]
pub struct GetConfig;

/// Sets config of the native program.
///
/// # Parameters
///
/// See [fields](#fields).
///
/// # Returns
///
/// [`ConnectorResponse::ConfigSet`] - No data.
///
#[derive(Deserialize, Debug, Eq, PartialEq, Clone)]
pub struct SetConfig(pub Config);

/// Installs the Firefox runtime.
///
/// This command will download the unmodified Mozilla Firefox from
/// the Mozilla servers and locally modify it. On Windows, this will
/// automatically install 7-Zip if it is not already installed, which
/// may require the user to accept the User Account Control prompt.
///
/// # Supported Platforms
///
/// - Windows: All (x86, x64, ARM64)
/// - MacOS: All (x64, ARM64)
/// - Linux: x86, x64
///
/// # Parameters
///
/// None.
///
/// # Returns
///
/// [`ConnectorResponse::RuntimeInstalled`] - No data.
///
#[derive(Debug, Eq, PartialEq, Clone)]
pub struct InstallRuntime;

/// Uninstalls the Firefox runtime.
///
/// # Parameters
///
/// None.
///
/// # Returns
///
/// [`ConnectorResponse::RuntimeUninstalled`] - No Data
///
#[derive(Debug, Eq, PartialEq, Clone)]
pub struct UninstallRuntime;

/// Gets all installed web apps.
///
/// # Parameters
///
/// None.
///
/// # Returns
///
/// [`ConnectorResponse::SiteList`]
///
#[derive(Debug, Eq, PartialEq, Clone)]
pub struct GetSiteList;

/// Launches a web app.
///
/// # Parameters
///
/// See [fields](#fields).
///
/// # Returns
///
/// [`ConnectorResponse::SiteLaunched`] - No data.
///
#[derive(Deserialize, Debug, Eq, PartialEq, Clone)]
pub struct LaunchSite {
    /// A web app ID.
    pub id: Ulid,

    /// Optional URL where to start a web app.
    ///
    /// Used to launch a web app on custom URL.
    /// If not specified, a default URL is used.
    pub url: Option<Url>,
}

/// Installs a new web app.
///
/// # Parameters
///
/// See [fields](#fields).
///
/// # Returns
///
/// [`ConnectorResponse::SiteInstalled`] - Generated ID of the installed web app.
///
#[derive(Deserialize, Debug, Eq, PartialEq, Clone)]
pub struct InstallSite {
    /// Direct URL of the site's web app manifest.
    pub manifest_url: Url,

    /// Direct URL of the site's main document.
    ///
    /// This is the URL from which the manifest parsing was triggered.
    /// Defaults to the result of parsing a manifest URL with `.`.
    pub document_url: Option<Url>,

    /// A custom web app start URL.
    ///
    /// Can be set by the user to overwrite the default start URL.
    /// If not set, defaults to the value specified in the manifest.
    pub start_url: Option<Url>,

    /// A custom web app name.
    ///
    /// Can be set by the user to overwrite the default name.
    /// If not set, defaults to the value specified in the manifest.
    pub name: Option<String>,

    /// A custom web app description.
    ///
    /// Can be set by the user to overwrite the default description.
    /// If not set, defaults to the value specified in the manifest.
    pub description: Option<String>,

    /// Custom web app categories.
    ///
    /// Can be set by the user to overwrite the default categories.
    /// If not set, defaults to the value specified in the manifest.
    pub categories: Option<Vec<String>>,

    /// Custom web app keywords.
    ///
    /// Can be set by the user to overwrite the default keywords.
    /// If not set, defaults to the value specified in the manifest.
    pub keywords: Option<Vec<String>>,

    /// Profile where this web app will be installed.
    ///
    /// Defaults to the default/shared profile.
    pub profile: Option<Ulid>,
}

/// Uninstalls a web app.
///
/// # Parameters
///
/// See [fields](#fields).
///
/// # Returns
///
/// [`ConnectorResponse::SiteUninstalled`] - No data.
///
#[derive(Deserialize, Debug, Eq, PartialEq, Clone)]
pub struct UninstallSite {
    /// A web app ID.
    pub id: Ulid,
}

/// Updates a web app.
///
/// # Parameters
///
/// See [fields](#fields).
///
/// - If an optional parameter is skipped (not specified), its value remains unchanged.
/// - If an optional parameter is set to `None`, its value is removed and replaced with the default.
/// - If an optional parameter is set to `Some` value, the new value is saved.
///
/// # Returns
///
/// [`ConnectorResponse::SiteUpdated`] - No data.
///
#[derive(Deserialize, Debug, Eq, PartialEq, Clone)]
pub struct UpdateSite {
    /// A web app ID.
    pub id: Ulid,

    /// A custom web app start URL.
    ///
    /// Can be set by the user to overwrite the default start URL.
    #[serde(default, deserialize_with = "double_option")]
    pub start_url: Option<Option<Url>>,

    /// A custom web app name.
    ///
    /// Can be set by the user to overwrite the default name.
    #[serde(default, deserialize_with = "double_option")]
    pub name: Option<Option<String>>,

    /// A custom web app description.
    ///
    /// Can be set by the user to overwrite the default description.
    #[serde(default, deserialize_with = "double_option")]
    pub description: Option<Option<String>>,

    /// Custom web app categories.
    ///
    /// Can be set by the user to overwrite the default categories.
    #[serde(default, deserialize_with = "double_option")]
    pub categories: Option<Option<Vec<String>>>,

    /// Custom web app keywords.
    ///
    /// Can be set by the user to overwrite the default keywords.
    #[serde(default, deserialize_with = "double_option")]
    pub keywords: Option<Option<Vec<String>>>,

    /// Enabled protocol handlers.
    ///
    /// A list of enabled protocol handlers supported by this web app.
    /// If empty, no handlers are registered to the operating system.
    pub enabled_protocol_handlers: Option<Vec<String>>,

    /// Whether the manifest should be updated (default: `true`).
    #[serde(default = "default_as_true")]
    pub update_manifest: bool,

    /// Whether the icons should be updated (default: `true`).
    #[serde(default = "default_as_true")]
    pub update_icons: bool,
}

/// Updates all web apps.
///
/// # Parameters
///
/// None.
///
/// # Returns
///
/// [`ConnectorResponse::AllSitesUpdated`] - No data.
///
#[derive(Deserialize, Debug, Eq, PartialEq, Clone)]
pub struct UpdateAllSites {
    /// Whether the manifest should be updated (default: `true`).
    #[serde(default = "default_as_true")]
    pub update_manifest: bool,

    /// Whether the icons should be updated (default: `true`).
    #[serde(default = "default_as_true")]
    pub update_icons: bool,
}

/// Gets all available profiles.
///
/// # Parameters
///
/// None.
///
/// # Returns
///
/// [`ConnectorResponse::ProfileList`]
///
#[derive(Debug, Eq, PartialEq, Clone)]
pub struct GetProfileList;

/// Creates a new profile.
///
/// # Parameters
///
/// See [fields](#fields).
///
/// # Returns
///
/// [`ConnectorResponse::ProfileCreated`] - Generated ID of the created profile.
///
#[derive(Deserialize, Debug, Eq, PartialEq, Clone)]
pub struct CreateProfile {
    /// A profile name.
    pub name: Option<String>,

    /// A profile description.
    pub description: Option<String>,
}

/// Removes a profile.
///
/// # Parameters
///
/// See [fields](#fields).
///
/// # Returns
///
/// [`ConnectorResponse::ProfileRemoved`] - No data.
///
#[derive(Deserialize, Debug, Eq, PartialEq, Clone)]
pub struct RemoveProfile {
    /// A profile ID.
    pub id: Ulid,
}

/// Updates a profile.
///
/// # Parameters
///
/// See [fields](#fields).
///
/// - If an optional parameter is skipped (not specified), its value remains unchanged.
/// - If an optional parameter is set to `None`, its value is removed and replaced with the default.
/// - If an optional parameter is set to `Some` value, the new value is saved.
///
/// # Returns
///
/// [`ConnectorResponse::ProfileUpdated`] - No data.
///
#[derive(Deserialize, Debug, Eq, PartialEq, Clone)]
pub struct UpdateProfile {
    /// A profile ID.
    pub id: Ulid,

    /// A profile name.
    #[serde(default, deserialize_with = "double_option")]
    pub name: Option<Option<String>>,

    /// A profile description.
    #[serde(default, deserialize_with = "double_option")]
    pub description: Option<Option<String>>,
}

deserialize_unit_struct!(GetSystemVersions);
deserialize_unit_struct!(GetConfig);
deserialize_unit_struct!(InstallRuntime);
deserialize_unit_struct!(UninstallRuntime);
deserialize_unit_struct!(GetSiteList);
deserialize_unit_struct!(GetProfileList);

build_request_enum!(
    GetSystemVersions,
    GetConfig,
    SetConfig,
    InstallRuntime,
    UninstallRuntime,
    GetSiteList,
    LaunchSite,
    InstallSite,
    UninstallSite,
    UpdateSite,
    UpdateAllSites,
    GetProfileList,
    CreateProfile,
    RemoveProfile,
    UpdateProfile,
);
