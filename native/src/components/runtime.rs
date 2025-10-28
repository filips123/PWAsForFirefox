use std::fs::{read_dir, remove_dir_all, remove_file};
use std::io::Result as IoResult;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};

use anyhow::{Context, Result, anyhow};
use cfg_if::cfg_if;
use configparser::ini::Ini;
use fs_extra::dir::{CopyOptions, copy};
use log::{info, warn};
use tempfile::{NamedTempFile, TempDir};

use crate::components::site::Site;
use crate::directories::ProjectDirs;

// TODO: Remove this constant and implement variable firefox path into user documentation
pub const FFOX: &str = {
    cfg_if! {
    if #[cfg(platform_termux)] {
        "@TERMUX_PREFIX@/lib/firefox/"
    } else {
    "/usr/lib/firefox/"
    }}
};

cfg_if! {
    if #[cfg(any(platform_linux, platform_termux, platform_bsd))] {
        use std::fs::{set_permissions, DirEntry};
        use std::os::unix::fs::PermissionsExt;

        fn visit_dirs(
            dir: &Path,
            source: &Path,
            target: &Path,
            cb: &dyn Fn(DirEntry, &Path, &Path),
        ) -> IoResult<()> {
            if dir.is_dir() {
                for entry in read_dir(dir)? {
                    let entry = entry?;
                    let path = entry.path();
                    if path.is_dir() {
                        visit_dirs(&path, source, target, cb)?;
                    }
                    if path.is_file() {
                        cb(entry, source, target);
                    }
                }
            }
            Ok(())
        }

        fn make_writable(entry: DirEntry, source: &Path, target: &Path) {
            let path = entry.path();
            let path = path.strip_prefix(source).unwrap();
            let path = target.join(path);

            if let Err(_e) = set_permissions(path, PermissionsExt::from_mode(0o644)) {
                warn!("Failed to make patch writable")
            }
        }
    }

    else if #[cfg(platform_windows)] {
        use std::ffi::c_void;
        use std::mem;

        use windows::core::BOOL;
        use windows::Win32::System::JobObjects::{
            IsProcessInJob,
            JobObjectExtendedLimitInformation,
            QueryInformationJobObject,
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
            JOB_OBJECT_LIMIT_BREAKAWAY_OK,
        };
        use windows::Win32::System::Threading::GetCurrentProcess;

        /// Check if the current process is in a job that allows breaking away.
        ///
        /// If the process is not in a job, breaking away is allowed by default.
        /// If the process is in a job, we need to query job info and check if
        /// the limit breakaway ok flag is set.
        fn allows_breakaway_from_job() -> Result<bool> {
            let mut process_in_job: BOOL = BOOL(0);
            unsafe { IsProcessInJob(GetCurrentProcess(), None, &mut process_in_job)? }

            if process_in_job.0 == 0 {
                return Ok(true);
            }

            let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();

            unsafe {
                QueryInformationJobObject(
                    None,
                    JobObjectExtendedLimitInformation,
                    &mut info as *mut _ as *mut c_void,
                    mem::size_of_val(&info) as u32,
                    None,
                )?
            }

            Ok(info.BasicLimitInformation.LimitFlags.0 & JOB_OBJECT_LIMIT_BREAKAWAY_OK.0 != 0)
        }
    }
}

#[allow(dead_code)]
const UNSUPPORTED_PLATFORM_ERROR: &str =
    "Cannot install runtime: Unsupported operating system or architecture!";

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
        if #[cfg(all(platform_windows, target_arch = "x86"))] {
            concatcp!(BASE_DOWNLOAD_URL, "win")
        } else if #[cfg(all(platform_windows, target_arch = "x86_64"))] {
            concatcp!(BASE_DOWNLOAD_URL, "win64")
        } else if #[cfg(all(platform_windows, target_arch = "aarch64"))] {
            concatcp!(BASE_DOWNLOAD_URL, "win64-aarch64")
        } else if #[cfg(all(platform_linux, target_arch = "x86"))] {
            concatcp!(BASE_DOWNLOAD_URL, "linux")
        } else if #[cfg(all(platform_linux, target_arch = "x86_64"))] {
            concatcp!(BASE_DOWNLOAD_URL, "linux64")
        } else if #[cfg(all(platform_linux, target_arch = "aarch64"))] {
            concatcp!(BASE_DOWNLOAD_URL, "linux64-aarch64")
        } else if #[cfg(platform_macos)] {
            concatcp!(BASE_DOWNLOAD_URL, "osx")
        } else {
            panic!("{}", UNSUPPORTED_PLATFORM_ERROR);
        }
    }
}

#[non_exhaustive]
#[derive(Debug, Eq, PartialEq, Clone)]
pub struct Runtime {
    pub version: Option<String>,

    pub directory: PathBuf,
    pub executable: PathBuf,
    pub config: PathBuf,
}

impl Runtime {
    pub fn new(dirs: &ProjectDirs) -> Result<Self> {
        cfg_if! {
            if #[cfg(feature = "portable")] {
                // When compiling in PortableApps.com mode, the runtime is installed to <root>/App/PWAsForFirefox/runtime
                // This is used to comply with PortableApps.com guidelines about not having binary files in <root>/Data
                Self::new_in_directory(dirs.sysdata.join("runtime"))
            } else {
                // Try to get a runtime from the user data directory by default
                // If that does not exist, try to get a runtime the system data directory
                // If neither exist, return the user data directory as a runtime directory

                let runtime_in_userdata = Self::new_in_directory(dirs.userdata.join("runtime"))?;
                if runtime_in_userdata.version.is_some() { return Ok(runtime_in_userdata); }

                let runtime_in_sysdata = Self::new_in_directory(dirs.sysdata.join("runtime"))?;
                if runtime_in_sysdata.version.is_some() { return Ok(runtime_in_sysdata); }

                Ok(runtime_in_userdata)
            }
        }
    }

    fn new_in_directory(directory: PathBuf) -> Result<Self> {
        let executable = {
            cfg_if! {
                if #[cfg(platform_windows)] {
                    directory.join("firefox.exe")
                } else if #[cfg(any(platform_linux, platform_termux, platform_bsd))] {
                    directory.join("firefox")
                } else if #[cfg(platform_macos)] {
                    directory.join("Firefox.app/Contents/MacOS/firefox")
                } else {
                    compile_error!("Unknown operating system");
                }
            }
        };

        let config = {
            cfg_if! {
                if #[cfg(any(platform_windows, platform_linux, platform_termux, platform_bsd))] {
                    directory.join("application.ini")
                } else if #[cfg(platform_macos)] {
                    directory.join("Firefox.app/Contents/Resources/application.ini")
                } else {
                    compile_error!("Unknown operating system");
                }
            }
        };

        let version = if executable.exists() && config.exists() {
            const PARSE_ERROR: &str = "Failed to parse runtime INI file";
            const KEY_ERROR: &str = "Failed to access non-existing key in runtime INI file";

            let map = Ini::new()
                .load(config.as_path())
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

    #[cfg(not(feature = "immutable-runtime"))]
    pub fn install(self) -> Result<()> {
        const TEMP_FILE_ERROR: &str = "Failed to create a temporary file";
        const DOWNLOAD_ERROR: &str = "Failed to download the runtime";
        const EXTRACT_ERROR: &str = "Failed to extract the runtime";
        const COPY_ERROR: &str = "Failed to copy the runtime";
        const CLEANUP_ERROR: &str = "Failed to clean up the runtime";

        #[cfg(any(platform_linux, platform_termux))]
        {
            use crate::storage::Storage;

            let dirs = ProjectDirs::new()?;
            let mut storage = Storage::load(&dirs)?;

            if storage.config.use_linked_runtime {
                self.uninstall()?;
            }

            storage.config.use_linked_runtime = false;
            storage.write(&dirs)?;
        }

        warn!("This will download the unmodified Mozilla Firefox and locally modify it");
        warn!("Firefox is licensed under the Mozilla Public License 2.0");
        warn!("Firefox is a trademark of the Mozilla Foundation in the U.S. and other countries");
        warn!("This project is not affiliated with the Mozilla Foundation in any way");
        warn!("By using the runtime you agree to the Firefox Terms of Use and Privacy Notice");
        warn!("Firefox Terms of Use: https://www.mozilla.org/about/legal/terms/firefox/");
        warn!("Firefox Privacy Notice: https://www.mozilla.org/privacy/firefox/");
        warn!("Firefox Website: https://www.mozilla.org/firefox/");

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
            if #[cfg(platform_windows)] {
                use anyhow::bail;
                use crate::components::_7zip::_7Zip;

                let _7zip = _7Zip::new()?;
                let success = _7zip.run(vec!["x", &archive, &format!("-o{}", &extracted)]).context(EXTRACT_ERROR)?.success();
                if !success { bail!(EXTRACT_ERROR) }

                source.push("core");

            } else if #[cfg(any(platform_linux, platform_termux))] {
                use std::fs::File;
                use xz2::read::XzDecoder;
                use tar::Archive;

                let file = File::open(&archive).context(EXTRACT_ERROR)?;
                let mut compressed = Archive::new(XzDecoder::new(file));
                compressed.unpack(&extracted).context(EXTRACT_ERROR)?;

                source.push("firefox");

            } else if #[cfg(platform_macos)] {
                use dmg::Attach;

                let info = Attach::new(&archive).with().context(EXTRACT_ERROR)?;
                let mut mount_point = info.mount_point.clone();

                mount_point.push("Firefox.app");
                source.push("Firefox.app");

                let mut options = CopyOptions::new();
                options.content_only = true;
                copy(&mount_point, &source, &options)?;

                source.pop();

            } else {
                panic!("{}", UNSUPPORTED_PLATFORM_ERROR);
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

    #[cfg(all(any(platform_linux, platform_termux), not(feature = "immutable-runtime")))]
    pub fn link(&self) -> Result<()> {
        use std::fs::{copy, create_dir_all};
        use std::os::unix::fs::symlink;

        use crate::storage::Storage;

        let dirs = ProjectDirs::new()?;
        let mut storage = Storage::load(&dirs)?;

        self.uninstall()?;

        storage.config.use_linked_runtime = true;

        info!("Linking the runtime");

        // Prevents 'No such file or directory (os error 2)' during 'firefoxpwa runtime install --link'
        // by creating the '~/.local/share/firefoxpwa/runtime/' directory.
        if !Path::new(&self.directory).exists() {
            create_dir_all(&self.directory)?;
        }

        if Path::new(FFOX).exists() {
            for entry in read_dir(FFOX)?.flatten() {
                let entry = entry.path();
                match entry.file_name().expect("Couldn't retrieve a file name").to_str() {
                    // Use a different branch for the "defaults" folder due to the patches to apply afterwhile
                    Some("defaults") => {
                        create_dir_all(self.directory.join("defaults/pref"))?;
                        symlink(
                            entry.join("defaults/pref/channel-prefs.js"),
                            self.directory.join("defaults/pref/channel-prefs.js"),
                        )?;
                    }
                    Some("firefox-bin") => {
                        copy(entry, self.directory.join("firefox-bin"))?;
                    }
                    Some("firefox") => {
                        copy(entry, self.directory.join("firefox"))?;
                    }
                    Some(&_) => {
                        let link = self.directory.join(entry.file_name().unwrap());
                        symlink(entry, link)?;
                    }
                    None => todo!(),
                }
            }
        }

        storage.write(&dirs)?;

        info!("Runtime linked!");

        Ok(())
    }

    #[cfg(not(feature = "immutable-runtime"))]
    pub fn uninstall(&self) -> Result<()> {
        info!("Uninstalling the runtime");
        remove_dir_contents(&self.directory).context("Failed to remove runtime directory")?;

        info!("Runtime uninstalled!");
        Ok(())
    }

    #[allow(unused_variables)]
    pub fn patch(&self, dirs: &ProjectDirs, site: Option<&Site>) -> Result<()> {
        let source = dirs.sysdata.join("userchrome/runtime");

        cfg_if! {
            if #[cfg(platform_macos)] {
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
        #[allow(clippy::needless_borrow, clippy::needless_borrows_for_generic_args)]
        copy(&source, &target, &options).context("Failed to patch the runtime")?;

        cfg_if! {
            if #[cfg(any(platform_linux, platform_termux, platform_bsd))] {
                visit_dirs(&source, &source, target, &make_writable)?;
            }
        }

        cfg_if! {
            if #[cfg(platform_macos)] {
                use plist;

                // We remove the translation file so macOS shows the web app name
                // in the main menubar instead of the runtime name
                let native_translation = target.join("en.lproj");
                remove_dir_contents(native_translation).context("Failed to patch the runtime")?;

                let bundle = target.parent().unwrap().parent().unwrap();
                let info_plist = target.parent().unwrap().join("Info.plist");

                let mut info_plist_file = plist::Value::from_file(&info_plist)
                    .context("Failed to read runtime Info.plist")?;

                let info_plist_dict = info_plist_file
                    .as_dictionary_mut()
                    .context("Failed to parse runtime Info.plist")?;

                if let Some(site) = site {
                    // We patch the Info.plist with the current app name so the main menu shows the right name
                    info_plist_dict.insert("CFBundleName".into(), plist::Value::String(site.name()));
                }

                // We patch bundle identifier to prevent interfering with normal Firefox
                info_plist_dict.insert("CFBundleIdentifier".into(), "si.filips.firefoxpwa.runtime".into());

                // We also need to remove all Firefox system handlers to prevent interfering with ours
                let _ = info_plist_dict.remove("CFBundleDocumentTypes");
                let _ = info_plist_dict.remove("CFBundleURLTypes");
                let _ = info_plist_dict.remove("NSUserActivityTypes");

                info_plist_file.to_file_xml(&info_plist).context("Failed to write runtime Info.plist")?;

                // We are messing with the runtime app bundle, so its signed signature doesn't match any more...
                // Removing the signature helps
                Command::new("codesign")
                    .args(["--remove-signature", bundle.to_str().unwrap()])
                    .output()
                    .context("Failed to remove code signature from modified runtime")?;

                // Just removing the signature no longer works on recent versions of macOS (~ 12).
                // We therefore have to perform ad-hoc signing to create an acceptable signature.
                Command::new("codesign")
                    .args(["-s", "-", bundle.to_str().unwrap()])
                    .output()
                    .context("Failed to adhoc code sign modified runtime")?;

                // We messed with the signature and by removing the quarantine attribute
                // we can avoid complaints from macOS.
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
            if #[cfg(platform_windows)] {
                use std::os::windows::process::CommandExt;
                use windows::Win32::System::Threading::{CREATE_BREAKAWAY_FROM_JOB, DETACHED_PROCESS};

                let mut flags = DETACHED_PROCESS;
                if allows_breakaway_from_job().unwrap_or(true) { flags |= CREATE_BREAKAWAY_FROM_JOB }

                command.creation_flags(flags.0);
            }
        }

        Ok(command.args(args).envs(vars).spawn()?)
    }
}
