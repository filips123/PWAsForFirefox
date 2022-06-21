use anyhow::Result;

pub use crate::console::app::App;
use crate::console::app::{ProfileCommand, RuntimeCommand, SiteCommand};

pub mod app;
pub mod profile;
pub mod runtime;
pub mod site;

/// Parses and stores `Option<Option<X>>` parameters.
///
/// Rules:
/// - `None` - Ignores the parameter and keeps its previous value.
/// - `Some(None)` - Stores `None` and uses a default/manifest value.
/// - `Some(value)` - Stores `Some(value)`.
///
macro_rules! store_value {
    ($target:expr, $source:expr) => {
        match &$source {
            Some(value) => $target = value.to_owned(),
            None => {}
        };
    };
}

/// Parses and stores `Option<Vec<X>>` parameters.
///
/// This needs some weird parsing hacks to be compatible both with the
/// Serve-based API and Clap CLI: Array with only an empty string is
/// treated as `None`.
///
/// Rules:
/// - `None` - Ignores the parameter and keeps its previous value.
/// - `Some(vec![""])` -> Stores `None` and uses a default/manifest value.
/// - `Some(vec![a, b, c])` - Stores `Some(vec![a, b, c])`.
///
macro_rules! store_value_vec {
    ($target:expr, $source:expr) => {
        if let Some(source) = &$source {
            if source.len() == 1 && source.first() == Some(&"".into()) {
                $target = None;
            } else {
                $target = Some(source.to_vec());
            }
        }
    };
}

pub(in crate::console) use {store_value, store_value_vec};

pub trait Run {
    fn run(&self) -> Result<()>;
}

impl Run for App {
    #[inline]
    fn run(&self) -> Result<()> {
        match self {
            App::Site(cmd) => cmd.run(),
            App::Profile(cmd) => cmd.run(),
            App::Runtime(cmd) => cmd.run(),
        }
    }
}

impl Run for SiteCommand {
    #[inline]
    fn run(&self) -> Result<()> {
        match self {
            SiteCommand::Launch(cmd) => cmd.run(),
            SiteCommand::Install(cmd) => cmd.run(),
            SiteCommand::Uninstall(cmd) => cmd.run(),
            SiteCommand::Update(cmd) => cmd.run(),
        }
    }
}

impl Run for ProfileCommand {
    #[inline]
    fn run(&self) -> Result<()> {
        match self {
            ProfileCommand::List(cmd) => cmd.run(),
            ProfileCommand::Create(cmd) => cmd.run(),
            ProfileCommand::Remove(cmd) => cmd.run(),
            ProfileCommand::Update(cmd) => cmd.run(),
        }
    }
}

impl Run for RuntimeCommand {
    #[inline]
    fn run(&self) -> Result<()> {
        match self {
            RuntimeCommand::Install(cmd) => cmd.run(),
            RuntimeCommand::Uninstall(cmd) => cmd.run(),
        }
    }
}
