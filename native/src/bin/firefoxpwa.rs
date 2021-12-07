use std::process::exit;

use anyhow::Result;
use log::{error, LevelFilter};
use simplelog::{ColorChoice, Config, TermLogger, TerminalMode};
use structopt::StructOpt;

#[rustfmt::skip]
use firefoxpwa::console::{App, Run};

fn main() -> Result<()> {
    TermLogger::init(LevelFilter::Info, Config::default(), TerminalMode::Mixed, ColorChoice::Auto)?;

    let app: App = App::from_args();
    if let Err(error) = app.run() {
        error!("{:?}", error);
        exit(1);
    }

    Ok(())
}
