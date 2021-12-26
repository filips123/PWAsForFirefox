use std::process::Child;

use anyhow::{Context, Result};
use data_url::DataUrl;
use log::info;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use ulid::Ulid;
use url::Url;
use web_app_manifest::types::Url as ManifestUrl;
pub use web_app_manifest::WebAppManifest as SiteManifest;

use crate::components::runtime::Runtime;
use crate::directories::ProjectDirs;
use crate::integrations;

const DOWNLOAD_ERROR: &str = "Failed to download PWA manifest";
const DATA_URL_ERROR: &str = "Failed to process PWA manifest data URL";
const PARSE_ERROR: &str = "Failed to parse PWA manifest";

const APP_USER_AGENT: &str = concat!(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:100.0) Gecko/20100101 Firefox/100.0 PWAsForFirefox/",
    env!("CARGO_PKG_VERSION")
);

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub struct SiteConfig {
    pub name: Option<String>,
    pub description: Option<String>,
    pub start_url: Option<Url>,
    pub document_url: Url,
    pub manifest_url: Url,

    #[serde(default)]
    pub categories: Vec<String>,

    #[serde(default)]
    pub keywords: Vec<String>,
}

#[non_exhaustive]
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub struct Site {
    pub ulid: Ulid,
    pub profile: Ulid,
    pub config: SiteConfig,
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

    pub fn new(profile: Ulid, config: SiteConfig) -> Result<Self> {
        info!("Downloading the PWA manifest");
        let json = Self::download(&config.manifest_url).context(DOWNLOAD_ERROR)?;

        // If the manifest URL is a data URL, replace it with the document URL
        let manifest_url = if config.manifest_url.scheme() != "data" {
            &config.manifest_url
        } else {
            &config.document_url
        };

        info!("Parsing the PWA manifest");
        let mut manifest: SiteManifest = serde_json::from_str(&json).context(PARSE_ERROR)?;
        manifest.process(&config.document_url, manifest_url).context(PARSE_ERROR)?;

        Ok(Self { ulid: Ulid::new(), profile, config, manifest })
    }

    pub fn update(&mut self) -> Result<()> {
        // There is nothing to update if the manifest is a data URL because it is always static
        if self.config.manifest_url.scheme() == "data" {
            return Ok(());
        }

        info!("Downloading the PWA manifest");
        let json = Self::download(&self.config.manifest_url).context(DOWNLOAD_ERROR)?;

        info!("Parsing the PWA manifest");
        let mut manifest: SiteManifest = serde_json::from_str(&json).context(PARSE_ERROR)?;
        manifest
            .process(&self.config.document_url, &self.config.manifest_url)
            .context(PARSE_ERROR)?;

        self.manifest = manifest;
        Ok(())
    }

    #[inline]
    pub fn install_system_integration(&self, dirs: &ProjectDirs) -> Result<()> {
        info!("Installing system integration");
        integrations::install(self, dirs)
    }

    #[inline]
    pub fn uninstall_system_integration(&self, dirs: &ProjectDirs) -> Result<()> {
        info!("Uninstalling system integration");
        integrations::uninstall(self, dirs)
    }

    #[inline]
    pub fn launch<I: IntoIterator<Item = (String, String)>>(
        &self,
        dirs: &ProjectDirs,
        runtime: &Runtime,
        url: &Option<Url>,
        arguments: &[String],
        variables: I,
    ) -> Result<Child> {
        let profile = dirs.userdata.join("profiles").join(&self.profile.to_string());

        #[rustfmt::skip]
        let mut args = vec![
            "--class".into(), format!("FFPWA-{}", self.ulid.to_string()),
            "--name".into(), format!("FFPWA-{}", self.ulid.to_string()),
            "--profile".into(), profile.display().to_string(),
            "--pwa".into(), self.ulid.to_string(),
        ];

        if let Some(url) = url {
            #[rustfmt::skip]
            args.extend_from_slice(&[
                "--url".into(), url.to_string(),
            ]);
        }

        args.extend_from_slice(arguments);
        runtime.run(args, variables)
    }

    /// Scope domain is used as a publisher name or when the site name is undefined.
    /// Using scope instead of start URL because user should not be able to overwrite it.
    pub fn domain(&self) -> String {
        const INVALID_URL: &str = "Site without valid absolute URL is not possible";

        if let ManifestUrl::Absolute(url) = &self.manifest.scope {
            match url.host() {
                Some(domain) => domain.to_string(),
                None => unreachable!(INVALID_URL),
            }
        } else {
            unreachable!(INVALID_URL)
        }
    }

    /// First try the user-specified name, then try manifest name and then short name.
    /// If this returns `None`, the caller is expected to use the domain name instead.
    pub fn name(&self) -> Option<String> {
        self.config
            .name
            .as_ref()
            .cloned()
            .or_else(|| self.manifest.name.as_ref().cloned())
            .or_else(|| self.manifest.short_name.as_ref().cloned())
    }
}
