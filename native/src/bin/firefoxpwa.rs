use std::process::exit;

use anyhow::Result;
use clap::Parser;
use log::{error, LevelFilter};
use simplelog::{ColorChoice, Config, TermLogger, TerminalMode};

#[rustfmt::skip]
use firefoxpwa::console::{App, Run};

fn main() -> Result<()> {
    TermLogger::init(LevelFilter::Info, Config::default(), TerminalMode::Mixed, ColorChoice::Auto)?;

    let app = App::parse();
    if let Err(error) = app.run() {
        error!("{:?}", error);
        exit(1);
    }

    Ok(())
}
