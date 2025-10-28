use std::fs::create_dir_all;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use cfg_if::cfg_if;
use directories::BaseDirs;

macro_rules! set_path_from_env {
    ($target:expr, $source:expr, $base:expr) => {
        match std::env::var($source) {
            Ok(value) => $target = expand_tilde(value, $base.home_dir()),
            Err(_) => {}
        };
    };
}

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
    /// Contains the main `firefoxpwa` executable that handles the command-line features and
    /// launches web apps.
    ///
    /// On Windows, also contains the `firefoxpwa-connector` executable that handles native
    /// messaging connections from the browser extension, and the native app manifest. On Linux
    /// and macOS, they are located at the appropriate locations for that platform.
    ///
    /// Can be overwritten by a `FFPWA_EXECUTABLES` build- or run-time environment variable.
    ///
    /// **Important:** Changing this variable to another directory also requires modifying
    /// the installation scripts to install executables into that directory and set the
    /// correct native app manifest path.
    ///
    /// ## Default value
    /// - Windows: `C:\Program Files\FirefoxPWA\` or `C:\Program Files (x86)\FirefoxPWA\`
    /// - Linux: `/usr/bin/`
    /// - macOS & BSD: `/usr/local/bin/`
    /// - Homebrew: `#{prefix}/bin/`
    ///
    /// ## Required permissions
    /// - Read
    ///
    pub executables: PathBuf,

    /// Global system directory for the project data.
    ///
    /// Stores the UserChrome modifications which are later copied to the user-specific
    /// profile directories at the web-app-launch-time.
    ///
    /// On Windows, also contains the shell completions files. On Linux and macOS, they are
    /// located at the appropriate locations for that platform.
    ///
    /// Can be overwritten by a `FFPWA_SYSDATA` build- or run-time environment variable.
    ///
    /// **Important:** Changing this variable to another directory also requires modifying
    /// the installation scripts to install system project data into that directory.
    ///
    /// ## Default value
    /// - Windows: `C:\Program Files\FirefoxPWA\` or `C:\Program Files (x86)\FirefoxPWA\`
    /// - Linux: `/usr/share/firefoxpwa/`
    /// - macOS & BSD: `/usr/local/share/firefoxpwa/`
    /// - Homebrew: `#{prefix}/share/`
    ///
    /// ## Required permissions
    /// - Read
    ///
    pub sysdata: PathBuf,

    /// User-specific directory for the project data.
    ///
    /// Stores the internal Firefox instance, profile directories with user data,
    /// web app icons (on Windows), as well as the configuration and log files.
    ///
    /// Can be overwritten by a `FFPWA_USERDATA` build- or run-time environment variable.
    ///
    /// ## Default value
    /// - Windows: `%APPDATA%\FirefoxPWA\`
    /// - Linux & BSD: `$XDG_DATA_HOME/firefoxpwa/` or `$HOME/.local/share/firefoxpwa/`
    /// - macOS: `$HOME/Library/Application Support/firefoxpwa/`
    ///
    /// ## Required permissions
    /// - Read
    /// - Write
    ///
    pub userdata: PathBuf,
}

impl ProjectDirs {
    pub fn new() -> Result<Self> {
        // We need base directories to get the user directory (for expanding tilde)
        // and the app data directory (for a default user data location)
        let base = BaseDirs::new().context("Failed to determine base system directories")?;

        // Provide a way to prevent using run-time environment variables to change directories
        // This should only be used in specific circumstances (like some packaging requirements)
        // To enable this, set a `FFPWA_STATIC_DIRS` build-time environment variable to `1`
        // Note that the user might still be able to change some directories through other means
        // To prevent this, explicitly set all `FFPWA_` build-time directory variables
        let static_only_dirs = match option_env!("FFPWA_STATIC_DIRS") {
            Some(var) => var == "1",
            None => false,
        };

        cfg_if! {
            // On Windows, executables and system data are in the same directory
            // We can just obtain it once, store it, and re-use it for both directories
            if #[cfg(all(platform_windows, not(feature = "portable")))] {
                use windows_registry::{Key, CURRENT_USER, LOCAL_MACHINE};

                let path = |root: &Key| -> Result<PathBuf> {
                    let key = root.open(r"Software\filips\FirefoxPWA").context("Failed to open registry key")?;
                    let path = key.get_string("Path").context("Failed to read registry key")?;
                    Ok(PathBuf::from(path))
                };

                // We try to use per-user install if it exists, otherwise per-machine install
                // If both keys are absent, something is wrong with the installation
                let install = path(CURRENT_USER)
                    .or_else(|_| path(LOCAL_MACHINE))
                    .context("Failed to obtain path from registry")?;
            }
        }

        cfg_if! {
            // In PortableApps.com mode, all locations are based on the path of current EXE
            // We can just obtain it once, store it, and re-use it for all directories
            if #[cfg(all(platform_windows, feature = "portable"))] {
                const CURRENT_DIRECTORY_ERROR: &str = "Failed to get the current directory";
                const PARENT_DIRECTORY_ERROR: &str = "Failed to get the parent directory";
                let current = std::env::current_exe().context(CURRENT_DIRECTORY_ERROR)?;
                let install = current.parent().context(CURRENT_DIRECTORY_ERROR)?.to_path_buf();
                let data = install.ancestors().nth(2).context(PARENT_DIRECTORY_ERROR)?.join("Data");
            }
        }

        let mut executables = if let Some(envvar) = option_env!("FFPWA_EXECUTABLES") {
            expand_tilde(envvar, base.home_dir())
        } else {
            cfg_if! {
                if #[cfg(platform_windows)] {
                    install.clone()
                } else if #[cfg(platform_linux)] {
                    PathBuf::from("/usr/bin")
                } else if #[cfg(any(platform_macos, platform_bsd))] {
                    PathBuf::from("/usr/local/bin")
                } else if #[cfg(platform_termux)] {
                    PathBuf::from("@TERMUX_PREFIX@/bin")
                } else {
                    compile_error!("Unknown operating system")
                }
            }
        };

        let mut sysdata = if let Some(envvar) = option_env!("FFPWA_SYSDATA") {
            expand_tilde(envvar, base.home_dir())
        } else {
            cfg_if! {
                if #[cfg(platform_windows)] {
                    install
                } else if #[cfg(platform_linux)] {
                    PathBuf::from("/usr/share/firefoxpwa")
                } else if #[cfg(any(platform_macos, platform_bsd))] {
                    PathBuf::from("/usr/local/share/firefoxpwa")
                } else if #[cfg(platform_termux)] {
                    PathBuf::from("@TERMUX_PREFIX@/share/firefoxpwa")
                } else {
                    compile_error!("Unknown operating system")
                }
            }
        };

        let mut userdata = if let Some(envvar) = option_env!("FFPWA_USERDATA") {
            expand_tilde(envvar, base.home_dir())
        } else {
            cfg_if! {
                if #[cfg(all(platform_windows, not(feature = "portable")))] {
                    base.data_dir().join("FirefoxPWA")
                } else if #[cfg(all(platform_windows, feature = "portable"))] {
                    data
                } else if #[cfg(any(platform_linux, platform_macos, platform_termux, platform_bsd))] {
                    base.data_dir().join("firefoxpwa")
                } else {
                    compile_error!("Unknown operating system")
                }
            }
        };

        // If you want to overwrite default install locations, use build-time environment variables
        // See the struct fields comments for description about each directory

        // If you really need to overwrite install locations by editing source code, do this here
        // You can rely on the below line as an injection target for tools such as `sed`
        // INSTALL_LOCATIONS_INJECTION

        if !static_only_dirs {
            set_path_from_env!(executables, "FFPWA_EXECUTABLES", base);
            set_path_from_env!(sysdata, "FFPWA_SYSDATA", base);
            set_path_from_env!(userdata, "FFPWA_USERDATA", base);
        }

        create_dir_all(&userdata).context("Failed to create user data directory")?;

        Ok(Self { executables, sysdata, userdata })
    }
}
