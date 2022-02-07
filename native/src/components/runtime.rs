use std::fs::{read_dir, remove_dir_all, remove_file};
use std::io::Result as IoResult;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};

use anyhow::{anyhow, Context, Result};
use cfg_if::cfg_if;
use configparser::ini::Ini;
use fs_extra::dir::{copy, CopyOptions};
use log::{info, warn};
use tempfile::{NamedTempFile, TempDir};

use crate::components::site::Site;
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
fn get_download_url() -> &'static str {
    #[allow(unused_imports)]
    use const_format::concatcp;

    #[allow(dead_code)]
    const BASE_DOWNLOAD_URL: &str = "https://download.mozilla.org/?product=firefox-latest-ssl&os=";

    cfg_if! {
        if #[cfg(all(target_os = "windows", target_arch = "x86"))] {
            concatcp!(BASE_DOWNLOAD_URL, "win")
        } else if #[cfg(all(target_os = "windows", target_arch = "x86_64"))] {
            concatcp!(BASE_DOWNLOAD_URL, "win64")
        } else if #[cfg(all(target_os = "windows", target_arch = "aarch64"))] {
            concatcp!(BASE_DOWNLOAD_URL, "win64-aarch64")
        } else if #[cfg(all(target_os = "linux", target_arch = "x86"))] {
            concatcp!(BASE_DOWNLOAD_URL, "linux")
        } else if #[cfg(all(target_os = "linux", target_arch = "x86_64"))] {
            concatcp!(BASE_DOWNLOAD_URL, "linux64")
        } else if #[cfg(target_os = "macos")] {
            concatcp!(BASE_DOWNLOAD_URL, "osx")
        } else {
            panic!("Cannot install runtime: Unsupported operating system or architecture!");
        }
    }
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
        // Runtime is currently installed to a user-specific location along with other project files
        // If you want to overwrite locations of all project files, check `directories.rs`
        // If you want to overwrite only runtime location, replace the below line
        let directory = dirs.userdata.join("runtime");

        let executable = {
            cfg_if! {
                if #[cfg(target_os = "windows")] {
                    directory.join("firefox.exe")
                } else if #[cfg(target_os = "linux")] {
                    directory.join("firefox")
                } else if #[cfg(target_os = "macos")] {
                    directory.join("Firefox.app/Contents/MacOS/firefox")
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
                    directory.join("Firefox.app/Contents/Resources/application.ini")
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
                use dmg::Attach;

                let info = Attach::new(&archive).with().context(EXTRACT_ERROR)?;
                let mut options = CopyOptions::new();
                let mut mount_point = info.mount_point.clone();

                mount_point.push("Firefox.app");
                source.push("Firefox.app");

                options.content_only = true;
                copy(&mount_point, &source, &options)?;

                source.pop();
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

    #[allow(unused_variables)]
    pub fn patch(&self, dirs: &ProjectDirs, site: &Site) -> Result<()> {
        let source = dirs.sysdata.join("userchrome/runtime");

        cfg_if! {
            if #[cfg(target_os = "macos")] {
                let mut target = self.directory.clone();
                target.push("Firefox.app/Contents/Resources");
            } else {
                let target = &self.directory;
            }
        }

        let mut options = CopyOptions::new();
        options.content_only = true;
        options.overwrite = true;

        info!("Patching the runtime");
        copy(source, &target, &options).context("Failed to patch the runtime")?;

        cfg_if! {
            if #[cfg(target_os = "macos")] {
                use plist;

                let bundle = target.parent().unwrap().parent().unwrap();
                let native_translation = target.join("en.lproj");
                let info_plist = target.parent().unwrap().join("info.plist");
                let app_name = site.name().unwrap_or_else(|| site.domain().clone());
                let temp_runtime_name = plist::Value::String(app_name);

                // We remove the translation file so macOS shows the PWA name
                // in the main menubar instead of the runtime name
                remove_dir_contents(native_translation).context("Failed to patch the runtime")?;

                let mut info_plist_file = plist::Value::from_file(&info_plist)
                    .context("Failed to read runtime info.plist")?;

                let info_plist_dict = info_plist_file
                    .as_dictionary_mut()
                    .context("Failed to read runtime info.plist content")?;

                // We patch the runtime info.plist with the current app name,
                // so the main menu shows the right name
                info_plist_dict.insert("CFBundleName".into(), temp_runtime_name);
                info_plist_file.to_file_xml(&info_plist).context("Failed to write runtime info.plist")?;

                // We are messing with the runtime app bundle, so its signed signature doesn't match any more...
                // Removing the signature helps
                Command::new("codesign")
                    .args(["--remove-signature", bundle.to_str().unwrap()])
                    .output()
                    .context("Failed to remove code signature from modified runtime")?;

                // We removed the signature and by removing the quarantine attribute
                // We can skip the signature check
                Command::new("xattr")
                    .args(["-rd", "com.apple.quarantine", bundle.to_str().unwrap()])
                    .output()
                    .context("Failed to remove quarantine from runtime")?;
            }
        }

        info!("Runtime patched!");
        Ok(())
    }

    #[inline]
    pub fn run<I: IntoIterator<Item = (String, String)>>(
        &self,
        args: &[String],
        vars: I,
    ) -> Result<Child> {
        let mut command = Command::new(&self.executable);

        cfg_if! {
            if #[cfg(windows)] {
                use std::os::windows::process::CommandExt;
                use windows::Win32::System::Threading::{CREATE_BREAKAWAY_FROM_JOB, DETACHED_PROCESS};

                command.creation_flags(CREATE_BREAKAWAY_FROM_JOB | DETACHED_PROCESS);
            }
        }

        Ok(command.args(args).envs(vars).spawn()?)
    }
}
