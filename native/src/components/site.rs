use std::collections::BTreeMap;
use std::process::Child;

use anyhow::{Context, Result};
use data_url::DataUrl;
use log::info;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use ulid::Ulid;
use url::Url;
use web_app_manifest::resources::ProtocolHandlerResource;
use web_app_manifest::types::Url as ManifestUrl;
pub use web_app_manifest::WebAppManifest as SiteManifest;

use crate::components::runtime::Runtime;
use crate::directories::ProjectDirs;
use crate::storage::Config;

const DOWNLOAD_ERROR: &str = "Failed to download web app manifest";
const DATA_URL_ERROR: &str = "Failed to process web app manifest data URL";
const PARSE_ERROR: &str = "Failed to parse web app manifest";
const INVALID_URL: &str = "Web app without valid absolute URL is not possible";

const APP_USER_AGENT: &str = concat!(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:100.0) Gecko/20100101 Firefox/100.0 PWAsForFirefox/",
    env!("CARGO_PKG_VERSION")
);

/// Contains configuration for the web app.
///
/// Most optional data here are just overwrites for information
/// provided by the web app in its manifest. If they are not not
/// set, they will default to the value in the manifest.
///
/// This struct also contains few required configuration for
/// the web app, such as a document and manifest URL.
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub struct SiteConfig {
    /// A custom web app name.
    pub name: Option<String>,

    /// A custom web app description.
    pub description: Option<String>,

    /// A custom web app start URL.
    pub start_url: Option<Url>,

    /// Direct URL of the site's main document.
    pub document_url: Url,

    /// Direct URL of the site's web app manifest.
    pub manifest_url: Url,

    /// Custom web app categories.
    pub categories: Option<Vec<String>>,

    /// Custom web app keywords.
    pub keywords: Option<Vec<String>>,

    /// Enabled URL handlers.
    ///
    /// Contains web app URL scopes that the browser extension
    /// will intercept and open in the web app window.
    #[serde(default)]
    pub enabled_url_handlers: Vec<String>,

    /// Enabled protocol handlers.
    ///
    /// Contains web app's protocol schemes (without the trailing `:`)
    /// that are registered to the operating system.
    ///
    /// Both the handlers specified in the manifest and ones added
    /// using the `registerProtocolHandler` API must be included here
    /// in order to be registered.
    #[serde(default)]
    pub enabled_protocol_handlers: Vec<String>,

    /// Custom protocol handlers.
    ///
    /// Contains protocol handlers dynamically registered using
    /// the [`registerProtocolHandler`] JavaScript API.
    ///
    /// [`registerProtocolHandler`]: https://developer.mozilla.org/docs/Web/API/Navigator/registerProtocolHandler
    #[serde(default)]
    pub custom_protocol_handlers: Vec<ProtocolHandlerResource>,
}

#[non_exhaustive]
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub struct Site {
    /// A web app ID.
    ///
    /// Stored as the ULID format. Unique for each web app
    /// instance and auto-generated when a web app is installed.
    pub ulid: Ulid,

    /// A profile ID.
    ///
    /// Represents the profile where this web app is installed.
    pub profile: Ulid,

    /// A web app config.
    pub config: SiteConfig,

    /// A web app manifest.
    pub manifest: SiteManifest,
}

impl Site {
    fn download(url: &Url) -> Result<String> {
        // If the URL is not a data URL, just download it using reqwest
        let json = if url.scheme() != "data" {
            Client::builder()
                .user_agent(APP_USER_AGENT)
                .build()?
                .get(url.to_owned())
                .header(reqwest::header::REFERER, url.to_string())
                .send()?
                .text()?

        // If the URL is a data URL (used for installing non-PWA sites), decode it using data-url
        } else {
            let url = DataUrl::process(url.as_str()).context(DATA_URL_ERROR)?;
            let (body, _) = url.decode_to_vec().context(DATA_URL_ERROR)?;
            String::from_utf8(body).context(DATA_URL_ERROR)?
        };

        // Trim BOM from the URL to prevent JSON parse errors
        Ok(json.trim_start_matches('\u{feff}').into())
    }

    #[inline]
    pub fn new(profile: Ulid, config: SiteConfig) -> Result<Self> {
        info!("Downloading the web app manifest");
        let json = Self::download(&config.manifest_url).context(DOWNLOAD_ERROR)?;

        // If the manifest URL is a data URL, replace it with the document URL
        let manifest_url = if config.manifest_url.scheme() != "data" {
            &config.manifest_url
        } else {
            &config.document_url
        };

        info!("Parsing the web app manifest");
        let mut manifest: SiteManifest = serde_json::from_str(&json).context(PARSE_ERROR)?;
        manifest.process(&config.document_url, manifest_url).context(PARSE_ERROR)?;

        Ok(Self { ulid: Ulid::new(), profile, config, manifest })
    }

    #[inline]
    pub fn update(&mut self) -> Result<()> {
        // There is nothing to update if the manifest is a data URL because it is always static
        if self.config.manifest_url.scheme() == "data" {
            return Ok(());
        }

        info!("Downloading the web app manifest");
        let json = Self::download(&self.config.manifest_url).context(DOWNLOAD_ERROR)?;

        info!("Parsing the web app manifest");
        let mut manifest: SiteManifest = serde_json::from_str(&json).context(PARSE_ERROR)?;
        manifest
            .process(&self.config.document_url, &self.config.manifest_url)
            .context(PARSE_ERROR)?;

        self.manifest = manifest;
        Ok(())
    }

    #[inline]
    pub fn launch<I: IntoIterator<Item = (String, String)>>(
        &self,
        dirs: &ProjectDirs,
        runtime: &Runtime,
        config: &Config,
        url: &Option<Url>,
        arguments: &[String],
        variables: I,
    ) -> Result<Child> {
        let profile = dirs.userdata.join("profiles").join(&self.profile.to_string());

        // Pass all required PWA arguments to the runtime
        #[rustfmt::skip]
        let mut args = vec![
            "--class".into(), format!("FFPWA-{}", self.ulid.to_string()),
            "--name".into(), format!("FFPWA-{}", self.ulid.to_string()),
            "--profile".into(), profile.display().to_string(),
            "--pwa".into(), self.ulid.to_string(),
        ];

        // Allow launching web app on a specific URL
        if let Some(url) = url {
            args.extend_from_slice(&["--url".into(), url.to_string()]);
        }

        // Pass variables needed for specific runtime features
        let mut vars = BTreeMap::new();
        if config.runtime_enable_wayland {
            vars.insert("MOZ_ENABLE_WAYLAND".into(), "1".into());
        }
        if config.runtime_use_xinput2 {
            vars.insert("MOZ_USE_XINPUT2".into(), "1".into());
        }
        if config.runtime_use_portals {
            vars.insert("GTK_USE_PORTAL".into(), "1".into());
        }

        // Include all user arguments and variables and launch the runtime
        args.extend_from_slice(arguments);
        vars.extend(variables);
        runtime.run(&args, vars)
    }
}

impl Site {
    /// Start URL is used as an info URL on supported systems.
    #[rustfmt::skip]
    pub fn url(&self) -> String {
        // Try to get user-specified start URL
        if let Some(url) = &self.config.start_url { url.to_string() }

        // If not set, use manifest-provided start URL
        else if let ManifestUrl::Absolute(url) = &self.manifest.start_url { url.to_string() }

        // This should not happen on valid web apps
        else { unreachable!("{}", INVALID_URL) }
    }

    /// Domain of a web app's scope is used as a publisher name
    /// on supported systems or when the app name is undefined.
    pub fn domain(&self) -> String {
        if let ManifestUrl::Absolute(url) = &self.manifest.scope {
            match url.host() {
                Some(domain) => domain.to_string(),
                None => unreachable!("{}", INVALID_URL),
            }
        } else {
            unreachable!("{}", INVALID_URL)
        }
    }

    /// First tries the user-specified name, then try manifest name
    /// and then short name. If no name is specified, uses the domain.
    pub fn name(&self) -> String {
        self.config
            .name
            .as_ref()
            .cloned()
            .or_else(|| self.manifest.name.as_ref().cloned())
            .or_else(|| self.manifest.short_name.as_ref().cloned())
            .unwrap_or_else(|| self.domain())
    }

    /// First tries the user-specified description, then try manifest description.
    /// If no description is specified, returns an empty string.
    pub fn description(&self) -> String {
        self.config
            .description
            .as_ref()
            .cloned()
            .or_else(|| self.manifest.description.as_ref().cloned())
            .unwrap_or_else(|| "".into())
    }

    /// Categories can be used for user organization.
    ///
    /// There is no fixed list of categories, but some known categories are converted
    /// to XDG menu categories on Linux and Apple App Store categories on macOS.
    ///
    /// First tries the user-specified categories, then try manifest categories.
    pub fn categories(&self) -> &[String] {
        match &self.config.categories {
            Some(categories) => categories,
            None => &self.manifest.categories,
        }
    }

    /// Keywords can also be used for user organization and contain
    /// additional information that can be used to describe the web app.
    ///
    /// Keywords are used as additional search queries on Linux.
    ///
    /// First tries the user-specified keywords, then try manifest keywords.
    pub fn keywords(&self) -> &[String] {
        match &self.config.keywords {
            Some(keywords) => keywords,
            None => &self.manifest.keywords,
        }
    }
}
