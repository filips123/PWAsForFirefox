use clap::CommandFactory;
use clap_complete::{generate_to, Shell};

#[path = "src/console/app.rs"]
mod app;

fn main() {
    let out = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let target = out.ancestors().nth(3).unwrap().to_owned();
    let completions = target.join("completions");

    std::fs::create_dir_all(&completions).unwrap();

    let mut app = app::App::command();
    generate_to(Shell::Bash, &mut app, env!("CARGO_PKG_NAME"), &completions).unwrap();
    generate_to(Shell::Elvish, &mut app, env!("CARGO_PKG_NAME"), &completions).unwrap();
    generate_to(Shell::Fish, &mut app, env!("CARGO_PKG_NAME"), &completions).unwrap();
    generate_to(Shell::PowerShell, &mut app, env!("CARGO_PKG_NAME"), &completions).unwrap();
    generate_to(Shell::Zsh, &mut app, env!("CARGO_PKG_NAME"), &completions).unwrap();
}
