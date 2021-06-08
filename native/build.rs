use clap::Shell;
use structopt::StructOpt;

#[path = "src/console/app.rs"]
mod app;

fn main() {
    let profile = std::env::var_os("PROFILE").unwrap().into_string().unwrap();
    let dir = format!("target/{}/completions", profile);

    std::fs::create_dir_all(&dir).unwrap();

    app::App::clap().gen_completions(env!("CARGO_PKG_NAME"), Shell::Bash, &dir);
    app::App::clap().gen_completions(env!("CARGO_PKG_NAME"), Shell::Elvish, &dir);
    app::App::clap().gen_completions(env!("CARGO_PKG_NAME"), Shell::Fish, &dir);
    app::App::clap().gen_completions(env!("CARGO_PKG_NAME"), Shell::PowerShell, &dir);
    app::App::clap().gen_completions(env!("CARGO_PKG_NAME"), Shell::Zsh, &dir);
}
