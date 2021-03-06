use std::fs::remove_file;
use std::path::PathBuf;
use std::process::{Command, ExitStatus};

use anyhow::{bail, Context, Result};
use cfg_if::cfg_if;
use const_format::formatcp;
use log::{info, warn};
use runas::Command as ElevatedCommand;
use tempfile::Builder;
use winreg::enums::HKEY_LOCAL_MACHINE;
use winreg::RegKey;

#[inline]
const fn get_download_url() -> &'static str {
    const VERSION: &str = "2101";

    cfg_if! {
        if #[cfg(target_arch = "x86")] {
            const ARCHITECTURE: &str = "";
        } else if #[cfg(target_arch = "x86_64")] {
            const ARCHITECTURE: &str = "-x64";
        } else if #[cfg(target_arch = "aarch64")] {
            const ARCHITECTURE: &str = "-arm64";
        } else {
            compile_error!("Unknown architecture");
        }
    }

    formatcp!("https://7-zip.org/a/7z{VERSION}{ARCHITECTURE}.exe")
}

#[non_exhaustive]
#[derive(Debug, Eq, PartialEq, Clone)]
pub struct _7Zip {
    pub version: Option<String>,
    executable: Option<PathBuf>,
}

impl _7Zip {
    pub fn new() -> Result<Self> {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let subkey = hklm.open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Uninstall\7-Zip");

        let version;
        let executable;

        match subkey {
            Ok(subkey) => {
                let display_version: String = subkey.get_value("DisplayVersion")?;
                let install_location: String = subkey.get_value("InstallLocation")?;

                version = Some(display_version);
                executable = Some(PathBuf::from(install_location).join("7z.exe"));
            }
            Err(_) => {
                version = None;
                executable = None;
            }
        }

        Ok(Self { version, executable })
    }

    pub fn install(self) -> Result<()> {
        const TEMP_FILE_ERROR: &str = "Failed to create a temporary file";
        const DOWNLOAD_ERROR: &str = "Failed to download the 7-Zip installer";
        const EXEC_ERROR: &str = "Failed to execute the 7-Zip installer";
        const CLEANUP_ERROR: &str = "Failed to clean up the 7-Zip installer";

        warn!("This will install 7-Zip, made by Igor Pavlov, licensed under the GNU LGPL license and others");
        warn!("This project is not affiliated with the 7-Zip project or its developers in any way");
        warn!("Check the 7-zip website for more details: https://7-zip.org/");

        let mut installer = Builder::new()
            .prefix("firefoxpwa-7zip-")
            .suffix(".exe")
            .tempfile()
            .context(TEMP_FILE_ERROR)?;

        info!("Downloading the 7-Zip installer");
        let mut response = reqwest::blocking::get(get_download_url()).context(DOWNLOAD_ERROR)?;
        (response.copy_to(&mut installer.as_file_mut())).context(DOWNLOAD_ERROR)?;
        let (_, path) = installer.keep().context(DOWNLOAD_ERROR)?;

        info!("Executing the 7-Zip installer");
        warn!("Please follow the installer to install 7-Zip");
        warn!("You might need to accept the User Account Control prompt");
        if !(ElevatedCommand::new(&path).status().context(EXEC_ERROR)?).success() {
            bail!(EXEC_ERROR)
        }

        remove_file(path).expect(CLEANUP_ERROR);

        info!("7-Zip installed!");
        Ok(())
    }

    #[inline]
    pub fn run(&self, args: Vec<&str>) -> Result<ExitStatus> {
        let executable = match &self.executable {
            Some(executable) => executable,
            None => bail!("7-Zip is currently not installed"),
        };

        Ok(Command::new(executable).args(args).spawn()?.wait()?)
    }
}
