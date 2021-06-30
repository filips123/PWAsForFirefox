#![allow(clippy::large_enum_variant)]

use structopt::StructOpt;
use ulid::Ulid;
use url::Url;

#[derive(StructOpt, Debug, Eq, PartialEq, Clone)]
#[structopt(setting = clap::AppSettings::DeriveDisplayOrder)]
pub enum App {
    /// Manages the sites (PWAs)
    Site(SiteCommand),

    /// Manages the profiles
    Profile(ProfileCommand),

    /// Manages the runtime
    Runtime(RuntimeCommand),
}

#[derive(StructOpt, Debug, Eq, PartialEq, Clone)]
#[structopt(setting = clap::AppSettings::DeriveDisplayOrder)]
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

#[derive(StructOpt, Debug, Eq, PartialEq, Clone)]
#[structopt(setting = clap::AppSettings::DeriveDisplayOrder)]
pub struct SiteLaunchCommand {
    /// Identifier of the PWA
    pub id: Ulid,

    /// Optionally launches the PWA with a custom start URL
    #[structopt(long)]
    pub url: Option<Url>,
}

#[derive(StructOpt, Debug, Eq, PartialEq, Clone)]
#[structopt(setting = clap::AppSettings::DeriveDisplayOrder)]
pub struct SiteInstallCommand {
    /// Direct URL to the PWA web app manifest
    pub manifest_url: Url,

    /// Direct URL to the main PWA document (defaults to the result of parsing manifest URL with `.`)
    #[structopt(long)]
    pub document_url: Option<Url>,

    /// Identifier of the custom profile for this PWA (defaults to the shared profile)
    #[structopt(long)]
    pub profile: Option<Ulid>,

    /// Optionally overwrites the PWA start URL specified in the manifest
    #[structopt(long)]
    pub start_url: Option<Url>,

    /// Optionally overwrites the PWA name specified in the manifest
    #[structopt(long)]
    pub name: Option<String>,

    /// Optionally overwrites the PWA description specified in the manifest
    #[structopt(long)]
    pub description: Option<String>,

    /// Optionally overwrites the PWA categories specified in the manifest
    #[structopt(long)]
    pub categories: Vec<String>,

    /// Optionally overwrites the PWA keywords specified in the manifest
    #[structopt(long)]
    pub keywords: Vec<String>,

    /// Disables system integration
    #[structopt(long = "no-system-integration", parse(from_flag = std::ops::Not::not))]
    pub system_integration: bool,
}

#[derive(StructOpt, Debug, Eq, PartialEq, Clone)]
#[structopt(setting = clap::AppSettings::DeriveDisplayOrder)]
pub struct SiteUninstallCommand {
    /// Identifier of the PWA
    pub id: Ulid,

    /// Forces removal without any interactive prompts
    #[structopt(short, long)]
    pub quiet: bool,
}

#[derive(StructOpt, Debug, Eq, PartialEq, Clone)]
#[structopt(setting = clap::AppSettings::DeriveDisplayOrder)]
pub struct SiteUpdateCommand {
    /// Identifier of the PWA
    pub id: Ulid,

    /// Optionally overwrites the PWA start URL specified in the manifest
    #[structopt(long)]
    pub start_url: Option<Url>,

    /// Optionally overwrites the PWA name specified in the manifest
    #[structopt(long)]
    pub name: Option<String>,

    /// Optionally overwrites the PWA description specified in the manifest
    #[structopt(long)]
    pub description: Option<String>,

    /// Disables system integration
    #[structopt(long = "no-system-integration", parse(from_flag = std::ops::Not::not))]
    pub system_integration: bool,
}

#[derive(StructOpt, Debug, Eq, PartialEq, Clone)]
#[structopt(setting = clap::AppSettings::DeriveDisplayOrder)]
pub enum ProfileCommand {
    /// Lists available profiles and their sites
    List(ProfileListCommand),

    /// Creates a new profile
    Create(ProfileCreateCommand),

    /// Removes an existing profile
    Remove(ProfileRemoveCommand),

    /// Updates an extsing profile
    Update(ProfileUpdateCommand),
}

#[derive(StructOpt, Debug, Eq, PartialEq, Clone)]
#[structopt(setting = clap::AppSettings::DeriveDisplayOrder)]
pub struct ProfileListCommand {}

#[derive(StructOpt, Debug, Eq, PartialEq, Clone)]
#[structopt(setting = clap::AppSettings::DeriveDisplayOrder)]
pub struct ProfileCreateCommand {
    /// Name of the profile
    #[structopt(long)]
    pub name: Option<String>,

    /// Description of the profile
    #[structopt(long)]
    pub description: Option<String>,
}

#[derive(StructOpt, Debug, Eq, PartialEq, Clone)]
#[structopt(setting = clap::AppSettings::DeriveDisplayOrder)]
pub struct ProfileRemoveCommand {
    /// Identifier of the profile
    pub id: Ulid,

    /// Forces removal without any interactive prompts
    #[structopt(short, long)]
    pub quiet: bool,
}

#[derive(StructOpt, Debug, Eq, PartialEq, Clone)]
#[structopt(setting = clap::AppSettings::DeriveDisplayOrder)]
pub struct ProfileUpdateCommand {
    /// Identifier of the profile
    pub id: Ulid,

    /// Name of the profile
    #[structopt(long)]
    pub name: Option<String>,

    /// Description of the profile
    #[structopt(long)]
    pub description: Option<String>,
}

#[derive(StructOpt, Debug, Eq, PartialEq, Clone)]
#[structopt(setting = clap::AppSettings::DeriveDisplayOrder)]
pub enum RuntimeCommand {
    /// Installs the runtime
    Install(RuntimeInstallCommand),

    /// Uninstalls the runtime
    Uninstall(RuntimeUninstallCommand),
}

#[derive(StructOpt, Debug, Eq, PartialEq, Clone)]
#[structopt(setting = clap::AppSettings::DeriveDisplayOrder)]
pub struct RuntimeInstallCommand {}

#[derive(StructOpt, Debug, Eq, PartialEq, Clone)]
#[structopt(setting = clap::AppSettings::DeriveDisplayOrder)]
pub struct RuntimeUninstallCommand {}
