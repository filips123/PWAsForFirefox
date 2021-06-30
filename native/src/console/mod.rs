use anyhow::Result;

pub use crate::console::app::App;
use crate::console::app::{ProfileCommand, RuntimeCommand, SiteCommand};

pub mod app;
pub mod profile;
pub mod runtime;
pub mod site;

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
