use anyhow::Result;
use web_app_manifest::resources::{IconResource, ShortcutResource};
use web_app_manifest::types::Url as ManifestUrl;

use crate::components::site::Site;
use crate::directories::ProjectDirs;

#[rustfmt::skip]
#[cfg(target_os = "macos")]
use {std::process::Child, url::Url};

#[cfg(any(target_os = "linux", target_os = "macos"))]
mod categories;
mod implementation;
mod utils;

#[derive(Debug, Eq, PartialEq, Clone)]
pub struct SiteInfoInstall<'a> {
    id: String,
    url: String,
    domain: String,
    name: String,
    description: String,
    categories: &'a Vec<String>,
    keywords: &'a Vec<String>,
    icons: &'a Vec<IconResource>,
    shortcuts: &'a Vec<ShortcutResource>,
    old_name: Option<String>,
}

#[derive(Debug, Eq, PartialEq, Clone)]
pub struct SiteInfoUninstall {
    id: String,
    name: String,
}

#[inline]
pub fn install(site: &Site, dirs: &ProjectDirs, old_name: Option<String>) -> Result<()> {
    // Web app ID is used to generate all commands and as an identifier at various places
    let id = site.ulid.to_string();

    // Start URL is used as an info URL in ARP
    // First try the user-specified start URL, then try manifest start URL
    let url = if let Some(url) = &site.config.start_url {
        url.to_string()
    } else if let ManifestUrl::Absolute(url) = &site.manifest.start_url {
        url.to_string()
    } else {
        unreachable!("Web app without valid absolute URL is not possible")
    };

    let domain = site.domain();
    let name = site.name().unwrap_or_else(|| domain.clone());

    // First try the user-specified description, then try manifest description
    let description = if let Some(description) = &site.config.description {
        description.clone()
    } else if let Some(description) = &site.manifest.description {
        description.clone()
    } else {
        "".into()
    };

    // Categories can be used for user organization and describe in which categories does the web app belong
    // There is no fixed list of categories, but some known categories will be converted to XDG menu categories on Linux
    // First try the user-specified categories, then try manifest categories
    let categories = if !site.config.categories.is_empty() {
        &site.config.categories
    } else {
        &site.manifest.categories
    };

    // Keywords can also be used for user organization and contain additional words that can describe the web app
    // Keywords will be converted to XDG menu keywords on Linux and be used as additional search queries
    // First try the user-specified keywords, then try manifest keywords
    let keywords = if !site.config.keywords.is_empty() {
        &site.config.keywords
    } else {
        &site.manifest.keywords
    };

    // Generate site info struct
    let info = SiteInfoInstall {
        id,
        url,
        domain,
        name,
        description,
        categories,
        keywords,
        icons: &site.manifest.icons,
        shortcuts: &site.manifest.shortcuts,
        old_name,
    };

    // Apply system integration
    implementation::install(&info, dirs)
}

#[inline]
pub fn uninstall(site: &Site, dirs: &ProjectDirs) -> Result<()> {
    let id = site.ulid.to_string();
    let name = site.name().unwrap_or_else(|| site.domain());

    let info = SiteInfoUninstall { id, name };
    implementation::uninstall(&info, dirs)
}

#[cfg(target_os = "macos")]
#[inline]
pub fn launch(site: &Site, url: &Option<Url>, arguments: &[String]) -> Result<Child> {
    implementation::launch(site, url, arguments)
}
