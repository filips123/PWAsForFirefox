#![allow(clippy::large_enum_variant)]

use clap::Parser;
use ulid::Ulid;
use url::Url;

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
#[clap(global_setting(clap::AppSettings::PropagateVersion))]
#[clap(global_setting(clap::AppSettings::DeriveDisplayOrder))]
#[clap(version)]
pub enum App {
    /// Manages the sites (PWAs)
    #[clap(subcommand)]
    Site(SiteCommand),

    /// Manages the profiles
    #[clap(subcommand)]
    Profile(ProfileCommand),

    /// Manages the runtime
    #[clap(subcommand)]
    Runtime(RuntimeCommand),
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub enum SiteCommand {
    /// Launches the PWA by its ID
    Launch(SiteLaunchCommand),

    /// Installs the PWA from its web app manifest
    Install(SiteInstallCommand),

    /// Uninstalls the PWA by its ID
    Uninstall(SiteUninstallCommand),

    /// Updates the PWA by its ID
    Update(SiteUpdateCommand),
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct SiteLaunchCommand {
    /// Identifier of the PWA
    pub id: Ulid,

    /// Additional arguments for the Firefox runtime
    pub arguments: Vec<String>,

    /// Optionally launches the PWA with a custom start URL
    #[clap(long)]
    pub url: Option<Url>,

    /// Internal: Directly launches the PWA without system integration
    #[cfg(target_os = "macos")]
    #[clap(long, hide = true)]
    pub direct_launch: bool,
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct SiteInstallCommand {
    /// Direct URL to the PWA web app manifest
    pub manifest_url: Url,

    /// Direct URL to the main PWA document (defaults to the result of parsing manifest URL with `.`)
    #[clap(long)]
    pub document_url: Option<Url>,

    /// Identifier of the custom profile for this PWA (defaults to the shared profile)
    #[clap(long)]
    pub profile: Option<Ulid>,

    /// Optionally overwrites the PWA start URL specified in the manifest
    #[clap(long)]
    pub start_url: Option<Url>,

    /// Optionally overwrites the PWA name specified in the manifest
    #[clap(long)]
    pub name: Option<String>,

    /// Optionally overwrites the PWA description specified in the manifest
    #[clap(long)]
    pub description: Option<String>,

    /// Optionally overwrites the PWA categories specified in the manifest
    #[clap(long)]
    pub categories: Vec<String>,

    /// Optionally overwrites the PWA keywords specified in the manifest
    #[clap(long)]
    pub keywords: Vec<String>,

    /// Disables system integration
    #[clap(long = "no-system-integration", parse(from_flag = std::ops::Not::not))]
    pub system_integration: bool,
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct SiteUninstallCommand {
    /// Identifier of the PWA
    pub id: Ulid,

    /// Forces removal without any interactive prompts
    #[clap(short, long)]
    pub quiet: bool,
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct SiteUpdateCommand {
    /// Identifier of the PWA
    pub id: Ulid,

    /// Optionally overwrites the PWA start URL specified in the manifest
    #[clap(long)]
    pub start_url: Option<Url>,

    /// Optionally overwrites the PWA name specified in the manifest
    #[clap(long)]
    pub name: Option<String>,

    /// Optionally overwrites the PWA description specified in the manifest
    #[clap(long)]
    pub description: Option<String>,

    /// Optionally overwrites the PWA categories specified in the manifest
    #[clap(long)]
    pub categories: Vec<String>,

    /// Optionally overwrites the PWA keywords specified in the manifest
    #[clap(long)]
    pub keywords: Vec<String>,

    /// Disables manifest updates
    #[clap(long = "no-manifest-updates", parse(from_flag = std::ops::Not::not))]
    pub manifest_updates: bool,

    /// Disables system integration
    #[clap(long = "no-system-integration", parse(from_flag = std::ops::Not::not))]
    pub system_integration: bool,

    /// Internal: Treat `None` values as actual values
    #[clap(skip = true)]
    pub store_none_values: bool,
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub enum ProfileCommand {
    /// Lists available profiles and their sites
    List(ProfileListCommand),

    /// Creates a new profile
    Create(ProfileCreateCommand),

    /// Removes an existing profile
    Remove(ProfileRemoveCommand),

    /// Updates an existing profile
    Update(ProfileUpdateCommand),
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct ProfileListCommand {}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct ProfileCreateCommand {
    /// Name of the profile
    #[clap(long)]
    pub name: Option<String>,

    /// Description of the profile
    #[clap(long)]
    pub description: Option<String>,
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct ProfileRemoveCommand {
    /// Identifier of the profile
    pub id: Ulid,

    /// Forces removal without any interactive prompts
    #[clap(short, long)]
    pub quiet: bool,
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct ProfileUpdateCommand {
    /// Identifier of the profile
    pub id: Ulid,

    /// Name of the profile
    #[clap(long)]
    pub name: Option<String>,

    /// Description of the profile
    #[clap(long)]
    pub description: Option<String>,

    /// Internal: Treat `None` values as actual values
    #[clap(skip = true)]
    pub store_none_values: bool,
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub enum RuntimeCommand {
    /// Installs the runtime
    Install(RuntimeInstallCommand),

    /// Uninstalls the runtime
    Uninstall(RuntimeUninstallCommand),
}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct RuntimeInstallCommand {}

#[derive(Parser, Debug, Eq, PartialEq, Clone)]
pub struct RuntimeUninstallCommand {}
