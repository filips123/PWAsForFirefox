use std::fs::{read_dir, remove_dir_all, remove_file};
use std::io::Result as IoResult;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};

use anyhow::{anyhow, Context, Result};
use cfg_if::cfg_if;
use configparser::ini::Ini;
use const_format::formatcp;
use fs_extra::dir::{copy, CopyOptions};
use log::{info, warn};
use tempfile::{NamedTempFile, TempDir};

use crate::directories::ProjectDirs;

fn remove_dir_contents<P: AsRef<Path>>(path: P) -> IoResult<()> {
    if !path.as_ref().exists() {
        return Ok(());
    }

    for entry in read_dir(path)? {
        let entry = entry?;
        let path = entry.path();

        if entry.file_type()?.is_dir() {
            remove_dir_all(path)?;
        } else {
            remove_file(path)?;
        }
    }

    Ok(())
}

#[inline]
const fn get_download_url() -> &'static str {
    cfg_if! {
        if #[cfg(all(target_os = "windows", target_arch = "x86"))] {
            const OS_AND_ARCHITECTURE: &str = "win32";
        } else if #[cfg(all(target_os = "windows", target_arch = "x86_64"))] {
            const OS_AND_ARCHITECTURE: &str = "win64";
        } else if #[cfg(all(target_os = "windows", target_arch = "aarch64"))] {
            const OS_AND_ARCHITECTURE: &str = "win64-aarch64";
        } else if #[cfg(all(target_os = "linux", target_arch = "x86"))] {
            const OS_AND_ARCHITECTURE: &str = "linux";
        } else if #[cfg(all(target_os = "linux", target_arch = "x86_64"))] {
            const OS_AND_ARCHITECTURE: &str = "linux64";
        } else if #[cfg(target_os = "macos")] {
            const OS_AND_ARCHITECTURE: &str = "osx";
        } else {
            compile_error!("Unknown operating system and architecture");
        }
    }

    formatcp!("https://download.mozilla.org/?product=firefox-latest-ssl&os={OS_AND_ARCHITECTURE}")
}

#[non_exhaustive]
#[derive(Debug, Eq, PartialEq, Clone)]
pub struct Runtime {
    pub version: Option<String>,

    directory: PathBuf,
    executable: PathBuf,
    config: PathBuf,
}

impl Runtime {
    pub fn new(dirs: &ProjectDirs) -> Result<Self> {
        let directory = dirs.install.join("runtime");

        let executable = {
            cfg_if! {
                if #[cfg(target_os = "windows")] {
                    directory.join("firefox.exe")
                } else if #[cfg(target_os = "linux")] {
                    directory.join("firefox")
                } else if #[cfg(target_os = "macos")] {
                    compile_error!("macOS is currently not supported");
                } else {
                    compile_error!("Unknown operating system");
                }
            }
        };

        let config = {
            cfg_if! {
                if #[cfg(any(target_os = "windows", target_os = "linux"))] {
                    directory.join("application.ini")
                } else if #[cfg(target_os = "macos")] {
                    compile_error!("macOS is currently not supported");
                } else {
                    compile_error!("Unknown operating system");
                }
            }
        };

        let version = if executable.exists() && config.exists() {
            const PATH_ERROR: &str = "Failed to convert runtime INI file path to string";
            const PARSE_ERROR: &str = "Failed to parse runtime INI file";
            const KEY_ERROR: &str = "Failed to access non-existing key in runtime INI file";

            let map = Ini::new()
                .load(config.to_str().context(PATH_ERROR)?)
                .map_err(|error| anyhow!(error))
                .context(PARSE_ERROR)?;
            let version = map
                .get("app")
                .context(KEY_ERROR)?
                .get("version")
                .context(KEY_ERROR)?
                .as_ref()
                .context(KEY_ERROR)?
                .to_owned();

            Some(version)
        } else {
            None
        };

        Ok(Self { version, directory, executable, config })
    }

    pub fn install(self) -> Result<()> {
        const TEMP_FILE_ERROR: &str = "Failed to create a temporary file";
        const DOWNLOAD_ERROR: &str = "Failed to download the runtime";
        const EXTRACT_ERROR: &str = "Failed to extract the runtime";
        const COPY_ERROR: &str = "Failed to copy the runtime";
        const CLEANUP_ERROR: &str = "Failed to clean up the runtime";

        warn!("This will download the unmodified Mozilla Firefox and locally modify it");
        warn!("Firefox is licensed under the Mozilla Public License 2.0");
        warn!("Firefox is a trademark of the Mozilla Foundation in the U.S. and other countries");
        warn!("This project is not affiliated with the Mozilla Foundation in any way");
        warn!("By using this project you also agree to the Firefox Privacy Notice: https://www.mozilla.org/privacy/firefox/");
        warn!("Check the Firefox website for more details: https://www.mozilla.org/firefox/");

        info!("Downloading the runtime archive");
        let mut archive = NamedTempFile::new().context(TEMP_FILE_ERROR)?;
        let mut response = reqwest::blocking::get(get_download_url()).context(DOWNLOAD_ERROR)?;
        (response.copy_to(&mut archive.as_file_mut())).context(DOWNLOAD_ERROR)?;

        // Path to downloaded archive
        let (_, archive) = archive.keep().context(DOWNLOAD_ERROR)?;
        let archive = archive.display().to_string();

        // Path to extracted archive
        let extracted = TempDir::new().context(TEMP_FILE_ERROR)?;
        let extracted = extracted.path().display().to_string();

        // Path to specific directory inside archive and its destination
        let mut source = PathBuf::from(&extracted);
        let destination = self.directory;

        info!("Extracting the runtime archive");
        cfg_if! {
            if #[cfg(target_os = "windows")] {
                use anyhow::bail;
                use crate::components::_7zip::_7Zip;

                let _7zip = _7Zip::new()?;
                let success = _7zip.run(vec!["x", &archive, &format!("-o{}", &extracted)]).context(EXTRACT_ERROR)?.success();
                if !success { bail!(EXTRACT_ERROR) }
                source.push("core");
            } else if #[cfg(target_os = "linux")] {
                use std::fs::File;
                use bzip2::read::BzDecoder;
                use tar::Archive;

                let mut compressed = Archive::new(BzDecoder::new(File::open(&archive)?));
                compressed.unpack(&extracted).context(EXTRACT_ERROR)?;
                source.push("firefox");
            } else if #[cfg(target_os = "macos")] {
                compile_error!("macOS is currently not supported");
            } else {
                compile_error!("Unknown operating system");
            }
        }

        let mut options = CopyOptions::new();
        options.content_only = true;

        info!("Copying the runtime");
        remove_dir_contents(&destination).context(CLEANUP_ERROR)?;
        copy(&source, &destination, &options).context(COPY_ERROR)?;

        remove_file(archive).context(CLEANUP_ERROR)?;
        remove_dir_all(extracted).context(CLEANUP_ERROR)?;

        info!("Runtime installed!");
        Ok(())
    }

    pub fn uninstall(self) -> Result<()> {
        info!("Uninstalling the runtime");
        remove_dir_contents(self.directory).context("Failed to remove runtime directory")?;

        info!("Runtime uninstalled!");
        Ok(())
    }

    pub fn patch(&self, dirs: &ProjectDirs) -> Result<()> {
        let source = dirs.install.join("userchrome/runtime");

        let mut options = CopyOptions::new();
        options.content_only = true;
        options.overwrite = true;

        info!("Patching the runtime");
        copy(source, &self.directory, &options).context("Failed to patch the runtime")?;

        info!("Runtime patched!");
        Ok(())
    }

    #[inline]
    pub fn run(&self, args: Vec<String>) -> Result<Child> {
        let mut command = Command::new(&self.executable);

        cfg_if! {
            if #[cfg(windows)] {
                use std::os::windows::process::CommandExt;
                use winapi::um::winbase::{CREATE_BREAKAWAY_FROM_JOB, DETACHED_PROCESS};

                command.creation_flags((DETACHED_PROCESS | CREATE_BREAKAWAY_FROM_JOB) as u32);
            } else if #[cfg(unix)] {
                // TODO: Check what needs to be done on Unix-like systems to prevent main Firefox process killing processes spawned by native messaging process
                // https://stackoverflow.com/questions/62978157/rust-how-to-spawn-child-process-that-continues-to-live-after-parent-receives-si
                // https://github.com/null-dev/firefox-profile-switcher-connector/blob/master/src/cmd/launch_profile.rs
            } else {
                compile_error!("Unknown operating system family");
            }
        }

        Ok(command.args(args).spawn()?)
    }
}
