use std::path::PathBuf;

use anyhow::Result;
use serde::{Deserialize, Deserializer};
use ulid::Ulid;
use url::Url;
use web_app_manifest::resources::ProtocolHandlerResource;

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
            fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
            where
                D: serde::de::Deserializer<'de>,
            {
                struct Visitor;

                impl<'de> serde::de::Visitor<'de> for Visitor {
                    type Value = $msg;

                    fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                        formatter.write_str(concat!(
                            "either no parameters or unit struct ",
                            stringify!($msg)
                        ))
                    }
                }

                let _ = deserializer.deserialize_unit_struct(stringify!($msg), Visitor);
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

    /// A custom web app icon URL.
    ///
    /// Can be set by the user to overwrite the default icons.
    /// If not set, defaults to the value specified in the manifest.
    pub icon_url: Option<Url>,

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

    /// Whether the web app should be launched on the system login.
    #[serde(default)]
    pub launch_on_login: bool,

    /// Whether the web app should be launched on the browser launch.
    #[serde(default)]
    pub launch_on_browser: bool,

    /// Contains a HTTP client configuration.
    #[serde(default)]
    pub client: HTTPClientConfig,
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

    /// A custom web app icon URL.
    ///
    /// Can be set by the user to overwrite the default icons.
    #[serde(default, deserialize_with = "double_option")]
    pub icon_url: Option<Option<Url>>,

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

    /// Enabled URL handlers.
    ///
    /// A list of enabled web app URL scopes that the browser
    /// extension will intercept and open in the web app window.
    /// If empty, no handlers are intercepted by the extension.
    pub enabled_url_handlers: Option<Vec<String>>,

    /// Enabled protocol handlers.
    ///
    /// A list of enabled protocol handlers supported by this web app.
    /// If empty, no handlers are registered to the operating system.
    pub enabled_protocol_handlers: Option<Vec<String>>,

    /// Whether the web app should be launched on the system login.
    #[serde(default)]
    pub launch_on_login: Option<bool>,

    /// Whether the web app should be launched on the browser launch.
    #[serde(default)]
    pub launch_on_browser: Option<bool>,

    /// Whether the manifest should be updated (default: `true`).
    #[serde(default = "default_as_true")]
    pub update_manifest: bool,

    /// Whether the icons should be updated (default: `true`).
    #[serde(default = "default_as_true")]
    pub update_icons: bool,

    /// Contains a HTTP client configuration.
    #[serde(default)]
    pub client: HTTPClientConfig,
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

    /// Contains a HTTP client configuration.
    #[serde(default)]
    pub client: HTTPClientConfig,
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

    /// A profile template.
    ///
    /// All contents of the provided template directory
    /// will be copied to a newly-created profile.
    pub template: Option<PathBuf>,
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

/// Registers a custom protocol handler.
///
/// Only one handler (either manifest or custom) per protocol scheme can exist
/// for each web app. Attempting to add another handler with the same scheme
/// will result in an error.
///
/// # Parameters
///
/// See [fields](#fields).
///
/// # Returns
///
/// [`ConnectorResponse::ProtocolHandlerRegistered`] - No data.
///
#[derive(Deserialize, Debug, Eq, PartialEq, Clone)]
pub struct RegisterProtocolHandler {
    /// A web app ID.
    pub site: Ulid,

    /// A handler to be registered.
    #[serde(flatten)]
    pub handler: ProtocolHandlerResource,

    /// Whether to enable this handler automatically (default: `true`).
    #[serde(default = "default_as_true")]
    pub enable: bool,
}

/// Unregisters a custom protocol handler.
///
/// # Parameters
///
/// See [fields](#fields).
///
/// # Returns
///
/// [`ConnectorResponse::ProtocolHandlerUnregistered`] - No data.
///
#[derive(Deserialize, Debug, Eq, PartialEq, Clone)]
pub struct UnregisterProtocolHandler {
    /// A web app ID.
    pub site: Ulid,

    /// A handler to be unregistered.
    #[serde(flatten)]
    pub handler: ProtocolHandlerResource,
}

/// Contains a HTTP client configuration.
#[derive(Deserialize, Debug, Eq, PartialEq, Clone, Default)]
pub struct HTTPClientConfig {
    /// A list of paths to DER certificate files.
    pub tls_root_certificates_der: Option<Vec<PathBuf>>,

    /// A list of paths to PE certificate files.
    pub tls_root_certificates_pem: Option<Vec<PathBuf>>,

    /// Whether the client accepts invalid certs (dangerous, default: `false`).
    #[serde(default)]
    pub tls_danger_accept_invalid_certs: bool,

    /// Whether the client accepts invalid hostnames (dangerous, default: `false`).
    #[serde(default)]
    pub tls_danger_accept_invalid_hostnames: bool,
}

#[allow(clippy::from_over_into)]
impl Into<crate::console::app::HTTPClientConfig> for HTTPClientConfig {
    fn into(self) -> crate::console::app::HTTPClientConfig {
        crate::console::app::HTTPClientConfig {
            tls_root_certificates_der: self.tls_root_certificates_der,
            tls_root_certificates_pem: self.tls_root_certificates_pem,
            tls_danger_accept_invalid_certs: self.tls_danger_accept_invalid_certs,
            tls_danger_accept_invalid_hostnames: self.tls_danger_accept_invalid_hostnames,
        }
    }
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
    RegisterProtocolHandler,
    UnregisterProtocolHandler,
);
