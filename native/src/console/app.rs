#![allow(clippy::large_enum_variant)]

use clap::Parser;
use ulid::Ulid;
use url::Url;

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
#[clap(global_setting(clap::AppSettings::PropagateVersion))]
#[clap(global_setting(clap::AppSettings::DeriveDisplayOrder))]
#[clap(version)]
pub enum App {
    /// Manage web apps
    #[clap(subcommand)]
    Site(SiteCommand),

    /// Manage profiles
    #[clap(subcommand)]
    Profile(ProfileCommand),

    /// Manage the runtime
    #[clap(subcommand)]
    Runtime(RuntimeCommand),
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub enum SiteCommand {
    /// Launch a web app
    Launch(SiteLaunchCommand),

    /// Install a web app
    Install(SiteInstallCommand),

    /// Uninstall a web app
    Uninstall(SiteUninstallCommand),

    /// Update a web app
    Update(SiteUpdateCommand),
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct SiteLaunchCommand {
    /// Web app ID
    pub id: Ulid,

    /// Arguments passed to the runtime
    pub arguments: Vec<String>,

    /// Launch web app on a custom start URL
    #[clap(long)]
    pub url: Option<Url>,

    /// Internal: Directly launch web app without system integration
    #[cfg(target_os = "macos")]
    #[clap(long, hide = true)]
    pub direct_launch: bool,
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct SiteInstallCommand {
    /// Direct URL of the site's web app manifest
    pub manifest_url: Url,

    /// Direct URL of the site's main document
    /// {n}Defaults to the result of parsing a manifest URL with `.`
    #[clap(long)]
    pub document_url: Option<Url>,

    /// Profile where this web app will be installed
    /// {n}Defaults to the shared profile
    #[clap(long)]
    pub profile: Option<Ulid>,

    /// Set a custom web app start URL
    #[clap(long)]
    pub start_url: Option<Url>,

    /// Set a custom web app name
    #[clap(long)]
    pub name: Option<String>,

    /// Set a custom web app description
    #[clap(long)]
    pub description: Option<String>,

    /// Set custom web app categories
    #[clap(long)]
    pub categories: Vec<String>,

    /// Set custom web app keywords
    #[clap(long)]
    pub keywords: Vec<String>,

    /// Disable system integration
    #[clap(long = "no-system-integration", parse(from_flag = std::ops::Not::not))]
    pub system_integration: bool,
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct SiteUninstallCommand {
    /// Web app ID
    pub id: Ulid,

    /// Disable any interactive prompts
    #[clap(short, long)]
    pub quiet: bool,
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct SiteUpdateCommand {
    /// Web app ID
    pub id: Ulid,

    /// Set a custom web app start URL
    #[clap(long)]
    pub start_url: Option<Url>,

    /// Set a custom web app name
    #[clap(long)]
    pub name: Option<String>,

    /// Set a custom web app description
    #[clap(long)]
    pub description: Option<String>,

    /// Set custom web app categories
    #[clap(long)]
    pub categories: Vec<String>,

    /// Set custom web app keywords
    #[clap(long)]
    pub keywords: Vec<String>,

    /// Disable manifest updates
    #[clap(long = "no-manifest-updates", parse(from_flag = std::ops::Not::not))]
    pub update_manifest: bool,

    /// Disable icon updates
    #[clap(long = "no-icon-updates", parse(from_flag = std::ops::Not::not))]
    pub update_icons: bool,

    /// Disable system integration
    #[clap(long = "no-system-integration", parse(from_flag = std::ops::Not::not))]
    pub system_integration: bool,

    /// Internal: Treat `None` values as actual values
    #[clap(long, hide = true)]
    pub store_none_values: bool,
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub enum ProfileCommand {
    /// List available profiles and their web apps
    List(ProfileListCommand),

    /// Create a new profile
    Create(ProfileCreateCommand),

    /// Remove an existing profile
    Remove(ProfileRemoveCommand),

    /// Update an existing profile
    Update(ProfileUpdateCommand),
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct ProfileListCommand {}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct ProfileCreateCommand {
    /// Set a profile name
    #[clap(long)]
    pub name: Option<String>,

    /// Set a profile description
    #[clap(long)]
    pub description: Option<String>,
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct ProfileRemoveCommand {
    /// Profile ID
    pub id: Ulid,

    /// Disable any interactive prompts
    #[clap(short, long)]
    pub quiet: bool,
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct ProfileUpdateCommand {
    /// Profile ID
    pub id: Ulid,

    /// Set a profile name
    #[clap(long)]
    pub name: Option<String>,

    /// Set a profile description
    #[clap(long)]
    pub description: Option<String>,

    /// Internal: Treat `None` values as actual values
    #[clap(long, hide = true)]
    pub store_none_values: bool,
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub enum RuntimeCommand {
    /// Install the runtime
    Install(RuntimeInstallCommand),

    /// Uninstall the runtime
    Uninstall(RuntimeUninstallCommand),
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct RuntimeInstallCommand {}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct RuntimeUninstallCommand {}
