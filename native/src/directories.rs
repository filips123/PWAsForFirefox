use std::fs::create_dir_all;
use std::path::PathBuf;

use anyhow::{Context, Result};
use cfg_if::cfg_if;
use directories::BaseDirs;

#[non_exhaustive]
#[derive(Debug, Eq, PartialEq, Clone)]
pub struct ProjectDirs {
    pub install: PathBuf,
    pub data: PathBuf,
}

impl ProjectDirs {
    pub fn new() -> Result<Self> {
        let install = {
            cfg_if! {
                if #[cfg(target_os = "windows")] {
                    use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};

                    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
                    let subkey = hklm.open_subkey(r"Software\filips\FirefoxPWA").context("Failed to open registry key")?;
                    let path: String = subkey.get_value("Path").context("Failed to read registry key")?;
                    PathBuf::from(path)
                } else if #[cfg(target_os = "linux")] {
                    PathBuf::from("/usr/share/firefoxpwa")
                } else if #[cfg(target_os = "macos")] {
                    PathBuf::from("/usr/local/share/firefoxpwa")
                } else {
                    compile_error!("Unknown operating system")
                }
            }
        };

        let data = {
            let base = BaseDirs::new().context("Failed to determine base system directories")?;
            let appdata = base.data_dir();

            cfg_if! {
                if #[cfg(any(target_os = "linux", target_os = "macos"))] { appdata.join("firefoxpwa") }
                else { appdata.join("FirefoxPWA") }
            }
        };

        create_dir_all(&install).context("Failed to create install directory")?;
        create_dir_all(&data).context("Failed to create data directory")?;

        Ok(Self { install, data })
    }
}
