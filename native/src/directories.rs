use std::fs::create_dir_all;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use cfg_if::cfg_if;
use directories::BaseDirs;

fn expand_tilde<P: AsRef<str>, H: AsRef<Path>>(path: P, home: H) -> PathBuf {
    let path = path.as_ref();
    let home = home.as_ref();

    // Path does not contain tilde, just return it
    if !path.starts_with('~') {
        return PathBuf::from(path);
    }

    // Join home directory with the path
    home.join(&path[2..])
}

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
    /// Can be overwritten by a `FFPWA_EXECUTABLES` build-time environment variable.
    ///
    /// Default value:
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
    /// Can be overwritten by a `FFPWA_SYSDATA` build-time environment variable.
    ///
    /// Default value:
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
    /// Can be overwritten by a `FFPWA_USERDATA` build-time environment variable.
    ///
    /// Default value:
    /// - Windows: `%APPDATA%\FirefoxPWA\`
    /// - Linux: `$XDG_DATA_HOME/firefoxpwa/` or `$HOME/.local/share/firefoxpwa/`
    /// - macOS: `$HOME/Library/Application Support/firefoxpwa/`
    ///
    pub userdata: PathBuf,
}

impl ProjectDirs {
    pub fn new() -> Result<Self> {
        // We need base directories to get the user directory (for expanding tilde)
        // and the app data directory (for a default user data location)
        let base = BaseDirs::new().context("Failed to determine base system directories")?;

        // On Windows, executables and system data are in the same directory
        // We can just obtain it once, store it, and re-use it for both directories
        // Variable needs to be prefixed with `_` so clippy does not complain on other OSes
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

        let executables = if let Some(envvar) = option_env!("FFPWA_EXECUTABLES") {
            expand_tilde(envvar, base.home_dir())
        } else {
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

        let sysdata = if let Some(envvar) = option_env!("FFPWA_SYSDATA") {
            expand_tilde(envvar, base.home_dir())
        } else {
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

        let userdata = if let Some(envvar) = option_env!("FFPWA_USERDATA") {
            expand_tilde(envvar, base.home_dir())
        } else {
            cfg_if! {
                if #[cfg(any(target_os = "linux", target_os = "macos"))] { base.data_dir().join("firefoxpwa") }
                else { base.data_dir().join("FirefoxPWA") }
            }
        };

        // If you want to overwrite install locations, use build-time environment variables
        // See the struct fields comments for description about each directory

        // If you really need to overwrite install locations by editing source code, do this here
        // You can rely on the below line as an injection target for tools such as `sed`
        // INSTALL_LOCATIONS_INJECTION

        create_dir_all(&sysdata).context("Failed to create system data directory")?;
        create_dir_all(&userdata).context("Failed to create user data directory")?;

        Ok(Self { executables, sysdata, userdata })
    }
}
