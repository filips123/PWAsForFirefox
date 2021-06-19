use std::process::Child;

use anyhow::{Context, Result};
use log::info;
use serde::{Deserialize, Serialize};
use ulid::Ulid;
use url::Url;
pub use web_app_manifest::WebAppManifest as SiteManifest;

use crate::components::runtime::Runtime;
use crate::directories::ProjectDirs;

const DOWNLOAD_ERROR: &str = "Failed to download PWA manifest";
const PARSE_ERROR: &str = "Failed to parse PWA manifest";

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub struct SiteConfig {
    pub name: Option<String>,
    pub description: Option<String>,
    pub categories: Vec<String>,
    pub document_url: Url,
    pub manifest_url: Url,
    pub start_url: Option<Url>,
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
    pub fn new(profile: Ulid, config: SiteConfig) -> Result<Self> {
        info!("Downloading the PWA manifest");
        let url = config.manifest_url.clone();
        let response = reqwest::blocking::get(url).context(DOWNLOAD_ERROR)?;
        let json = response.text().context(DOWNLOAD_ERROR)?;

        info!("Parsing the PWA manifest");
        let mut manifest: SiteManifest = serde_json::from_str(&json).context(PARSE_ERROR)?;
        manifest.process(&config.document_url, &config.manifest_url).context(PARSE_ERROR)?;

        Ok(Self { ulid: Ulid::new(), profile, config, manifest })
    }

    pub fn update(&mut self) -> Result<()> {
        info!("Downloading the PWA manifest");
        let url = self.config.manifest_url.clone();
        let response = reqwest::blocking::get(url).context(DOWNLOAD_ERROR)?;
        let json = response.text().context(DOWNLOAD_ERROR)?;

        info!("Parsing the PWA manifest");
        let mut manifest: SiteManifest = serde_json::from_str(&json).context(PARSE_ERROR)?;
        manifest
            .process(&self.config.document_url, &self.config.manifest_url)
            .context(PARSE_ERROR)?;

        self.manifest = manifest;
        Ok(())
    }

    #[inline]
    pub fn launch(
        &self,
        dirs: &ProjectDirs,
        runtime: &Runtime,
        url: &Option<Url>,
    ) -> Result<Child> {
        let profile = dirs.data.join("profiles").join(&self.profile.to_string());

        #[rustfmt::skip]
        let mut args = vec![
            "--class".into(), format!("FFPWA-{}", self.ulid.to_string()),
            "--profile".into(), profile.display().to_string(),
            "--pwa".into(), self.ulid.to_string(),
        ];

        if let Some(url) = url {
            #[rustfmt::skip]
            args.extend_from_slice(&[
                "--url".into(), url.to_string(),
            ]);
        }

        runtime.run(args)
    }
}
