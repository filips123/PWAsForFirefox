use clap::Shell;
use structopt::StructOpt;

#[path = "src/console/app.rs"]
mod app;

fn main() {
    let out = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let target = out.ancestors().nth(3).unwrap().to_owned();
    let completions = target.join("completions");

    std::fs::create_dir_all(&completions).unwrap();

    app::App::clap().gen_completions(env!("CARGO_PKG_NAME"), Shell::Bash, &completions);
    app::App::clap().gen_completions(env!("CARGO_PKG_NAME"), Shell::Elvish, &completions);
    app::App::clap().gen_completions(env!("CARGO_PKG_NAME"), Shell::Fish, &completions);
    app::App::clap().gen_completions(env!("CARGO_PKG_NAME"), Shell::PowerShell, &completions);
    app::App::clap().gen_completions(env!("CARGO_PKG_NAME"), Shell::Zsh, &completions);
}
