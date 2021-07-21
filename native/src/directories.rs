use std::fs::create_dir_all;
use std::path::PathBuf;

use anyhow::{Context, Result};
use cfg_if::cfg_if;
use directories::BaseDirs;

#[non_exhaustive]
#[derive(Debug, Eq, PartialEq, Clone)]
pub struct ProjectDirs {
    /// Global system directory for the main executable files.
    ///
    /// On all systems, it contains the main `firefoxpwa` executable
    /// that handles the command-line features and launches the sites.
    /// On Windows, it also contains `firefoxpwa-connector` that handles
    /// native messaging connections from the browser extension, native
    /// app manifest, and the shell completions.
    ///
    /// - Windows: `C:\Program Files\FirefoxPWA\` or `C:\Program Files (x86)\FirefoxPWA\`
    /// - Linux: `/usr/bin/`
    /// - macOS: `/usr/local/bin/`
    ///
    pub executables: PathBuf,

    /// Global system directory for the project data.
    ///
    /// Stores the UserChrome modifications which are later copied to
    /// the user-specific profile directories at the site-launch-time.
    ///
    /// - Windows: `C:\Program Files\FirefoxPWA\` or `C:\Program Files (x86)\FirefoxPWA\`
    /// - Linux: `/usr/share/firefoxpwa/`
    /// - macOS: `/usr/local/share/firefoxpwa/`
    ///
    pub sysdata: PathBuf,

    /// User-specific directory for the project data.
    ///
    /// Stores the installed browser runtime, profile directories with
    /// user data, site icons (on Windows), as well as config and log files.
    ///
    /// - Windows: `%APPDATA%\FirefoxPWA\`
    /// - Linux: `$XDG_DATA_HOME/firefoxpwa/` or `$HOME/.local/share/firefoxpwa/`
    /// - macOS: `$HOME/Library/Application Support/firefoxpwa/`
    ///
    pub userdata: PathBuf,
}

impl ProjectDirs {
    pub fn new() -> Result<Self> {
        let _install = {
            cfg_if! {
                if #[cfg(target_os = "windows")] {
                    use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};

                    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
                    let subkey = hklm.open_subkey(r"Software\filips\FirefoxPWA").context("Failed to open registry key")?;
                    let path: String = subkey.get_value("Path").context("Failed to read registry key")?;
                    PathBuf::from(path)
                }
            }
        };

        let executables = {
            cfg_if! {
                if #[cfg(target_os = "windows")] {
                    _install.clone()
                } else if #[cfg(target_os = "linux")] {
                    PathBuf::from("/usr/bin")
                } else if #[cfg(target_os = "macos")] {
                    PathBuf::from("/usr/local/bin")
                } else {
                    compile_error!("Unknown operating system")
                }
            }
        };

        let sysdata = {
            cfg_if! {
                if #[cfg(target_os = "windows")] {
                    _install
                } else if #[cfg(target_os = "linux")] {
                    PathBuf::from("/usr/share/firefoxpwa")
                } else if #[cfg(target_os = "macos")] {
                    PathBuf::from("/usr/local/share/firefoxpwa")
                } else {
                    compile_error!("Unknown operating system")
                }
            }
        };

        let userdata = {
            let base = BaseDirs::new().context("Failed to determine base system directories")?;
            let appdata = base.data_dir();

            cfg_if! {
                if #[cfg(any(target_os = "linux", target_os = "macos"))] { appdata.join("firefoxpwa") }
                else { appdata.join("FirefoxPWA") }
            }
        };

        // If you want to overwrite install locations, do this here
        // See the struct fields comments for description about each directory
        // See the commented lines below for a simple example
        // let executables = PathBuf::from("EXECUTABLES_DIR");
        // let sysdata = PathBuf::from("SYSDATA_DIR");
        // let userdata = PathBuf::from("USERDATA_DIR");

        create_dir_all(&sysdata).context("Failed to create system data directory")?;
        create_dir_all(&userdata).context("Failed to create user data directory")?;

        Ok(Self { executables, sysdata, userdata })
    }
}
