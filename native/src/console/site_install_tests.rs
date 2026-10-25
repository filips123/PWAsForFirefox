//! Regression coverage for manifest-based and manifestless CLI installations.

use clap::Parser;
use reqwest::blocking::Client;
use ulid::Ulid;
use url::Url;

use crate::components::site::{Site, SiteConfig};
use crate::console::app::{App, SiteCommand, SiteInstallCommand};

/// Parses an install command without accessing profiles or system integration.
fn parse_install(arguments: &[&str]) -> SiteInstallCommand {
    let app = App::try_parse_from(
        ["firefoxpwa", "site", "install"].into_iter().chain(arguments.iter().copied()),
    )
    .unwrap();

    match app {
        App::Site(SiteCommand::Install(command)) => command,
        _ => unreachable!(),
    }
}

/// Builds a site through the normal manifest parser without writing application data.
fn create_site(command: &SiteInstallCommand) -> Site {
    let (manifest_url, document_url) = command.installation_urls().unwrap();
    let config = SiteConfig {
        name: command.name.clone(),
        description: command.description.clone(),
        start_url: command.start_url.clone(),
        icon_url: command.icon_url.clone(),
        document_url,
        manifest_url,
        categories: command.categories.clone(),
        keywords: command.keywords.clone(),
        enabled_url_handlers: vec![],
        enabled_protocol_handlers: vec![],
        custom_protocol_handlers: vec![],
        launch_on_login: false,
        launch_on_browser: false,
    };

    Site::new(Ulid::nil(), config, &Client::new()).unwrap()
}

/// Neither a name nor a custom start URL substitutes for the required source URL.
#[test]
fn requires_manifest_or_document_url() {
    for arguments in
        [vec![], vec!["--name", "Example"], vec!["--start-url", "https://example.com/"]]
    {
        let error =
            App::try_parse_from(["firefoxpwa", "site", "install"].into_iter().chain(arguments))
                .unwrap_err();

        assert_eq!(error.kind(), clap::error::ErrorKind::MissingRequiredArgument);
    }
}

/// Synthetic manifests preserve complete document URLs and never need remote updates.
#[test]
fn installs_without_remote_manifest() {
    let document = "https://example.com/app/page?value=%22hello%22&other=%23test#section";
    let command = parse_install(&["--document-url", document]);
    let mut site = create_site(&command);
    assert_eq!(site.config.document_url.as_str(), document);
    assert_eq!(site.config.manifest_url.scheme(), "data");
    assert_eq!(site.url(), document);
    assert_eq!(site.name(), "example.com");

    let manifest = site.manifest.clone();
    site.update(&Client::new()).unwrap();
    assert_eq!(site.manifest, manifest);
}

/// Custom metadata remains effective when the manifest is generated locally.
#[test]
fn preserves_manifestless_overrides() {
    let start = "https://example.com/app/start";
    let icon = "https://example.com/icon.png";
    let command = parse_install(&[
        "--document-url",
        "https://example.com",
        "--start-url",
        start,
        "--name",
        "Example website",
        "--icon-url",
        icon,
    ]);
    let site = create_site(&command);
    assert_eq!(site.name(), "Example website");
    assert_eq!(site.url(), start);
    assert_eq!(site.config.icon_url, Some(Url::parse(icon).unwrap()));
    assert_eq!(site.icons().len(), 1);
}
