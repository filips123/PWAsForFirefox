use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::process::exit;
use std::{env, io};

use anyhow::{Context, Result};
use byteorder::{NativeEndian, ReadBytesExt, WriteBytesExt};
use cfg_if::cfg_if;
use log::{error, info};

use crate::components::runtime::Runtime;
use crate::connector::request::RequestMessage;
use crate::connector::response::ResponseMessage;
use crate::console::app::{
    ProfileCreateCommand,
    ProfileRemoveCommand,
    ProfileUpdateCommand,
    RuntimeInstallCommand,
    RuntimeUninstallCommand,
    SiteInstallCommand,
    SiteLaunchCommand,
    SiteUninstallCommand,
    SiteUpdateCommand,
};
use crate::console::Run;
use crate::directories::ProjectDirs;
use crate::storage::Storage;

mod request;
mod response;

#[derive(Debug, PartialEq, Clone)]
pub struct Connection<'a> {
    dirs: &'a ProjectDirs,
    runtime: Runtime,
    storage: Storage,
    debugmode: bool,
}

impl<'a> Connection<'a> {
    pub fn start(dirs: &'a ProjectDirs, debugmode: bool) -> Result<()> {
        let runtime = Runtime::new(dirs)?;
        let storage = Storage::load(dirs)?;

        let connection = Self { dirs, runtime, storage, debugmode };
        info!("Connection established: {:?}", env::args().collect::<Vec<String>>());

        let request = connection.receive().context("Failed to receive request")?;
        info!("Received a request: {:?}", request);

        let response = match connection.process(&request) {
            Ok(response) => {
                // Everything seems to be ok
                // Just unwrap the response and sent it back
                info!("Processed the request: {:?}", response);
                response
            }
            Err(error) => {
                // There was some error while processing the request
                // Pack it into a custom response message, send it back and abort the program
                let response = ResponseMessage::Error(format!("{:#}", error));

                error!("{:?}", error.context("Failed to process request"));
                connection.send(&response).context("Failed to send response")?;
                exit(1);
            }
        };

        connection.send(&response).context("Failed to send response")?;
        info!("Sent a response");

        Ok(())
    }

    fn receive(&self) -> Result<RequestMessage> {
        let size = io::stdin().read_u32::<NativeEndian>().context("Failed to read message size")?;
        let mut buffer = vec![0u8; size as usize];

        io::stdin().read_exact(&mut buffer).context("Failed to read message")?;
        serde_json::from_slice(&buffer).context("Failed to deserialize message")
    }

    fn send(&self, response: &ResponseMessage) -> Result<()> {
        let serialized = serde_json::to_vec(&response).context("Failed to serialize message")?;

        let stdout = io::stdout();
        let mut handle = stdout.lock();
        handle
            .write_u32::<NativeEndian>(serialized.len() as u32)
            .context("Failed to write message size")?;
        handle.write_all(&serialized).context("Failed to write message")?;
        handle.flush().context("Failed to flush stdout")?;

        Ok(())
    }

    fn process(&self, request: &RequestMessage) -> Result<ResponseMessage> {
        // If not in debug mode, discard both stdout and stderr
        // If in debug mode, redirect them to the log files
        // This is needed to prevent output that could corrupt response message
        let _stdout_rdr;
        let _stderr_rdr;
        let _stdout_gag;
        let _stderr_gag;

        if self.debugmode {
            let stdout = self.dirs.userdata.join("firefoxpwa-stdout.log");
            let stdout = OpenOptions::new().create(true).append(true).open(stdout)?;
            _stdout_rdr = gag::Redirect::stdout(stdout).context("Failed to redirect stdout")?;

            let stderr = self.dirs.userdata.join("firefoxpwa-stderr.log");
            let stderr = OpenOptions::new().create(true).append(true).open(stderr)?;
            _stderr_rdr = gag::Redirect::stderr(stderr).context("Failed to redirect stderr")?;
        } else {
            _stdout_gag = gag::Gag::stdout().context("Failed to discard stdout")?;
            _stderr_gag = gag::Gag::stderr().context("Failed to discard stderr")?;
        }

        // Process the request message and return a response
        match request {
            RequestMessage::GetSystemVersions => {
                let mut _7zip = None;

                #[cfg(target_os = "windows")]
                {
                    use crate::components::_7zip::_7Zip;
                    _7zip = _7Zip::new()?.version
                }

                Ok(ResponseMessage::SystemVersions {
                    firefoxpwa: Some(env!("CARGO_PKG_VERSION").into()),
                    firefox: self.runtime.version.clone(),
                    _7zip,
                })
            }

            RequestMessage::InstallRuntime => {
                // Just simulate calling runtime install command
                let command = RuntimeInstallCommand {};
                command.run()?;

                Ok(ResponseMessage::RuntimeInstalled)
            }

            RequestMessage::UninstallRuntime => {
                // Just simulate calling runtime install command
                let command = RuntimeUninstallCommand {};
                command.run()?;

                Ok(ResponseMessage::RuntimeUninstalled)
            }

            RequestMessage::GetSiteList => {
                Ok(ResponseMessage::SiteList(self.storage.sites.to_owned()))
            }

            RequestMessage::LaunchSite { id, url } => {
                // Just simulate calling site launch command
                cfg_if! {
                    if #[cfg(target_os = "macos")] {
                        let command = SiteLaunchCommand { id: *id, url: url.to_owned(), arguments: vec![], direct_launch: false };
                    } else {
                        let command = SiteLaunchCommand { id: *id, url: url.to_owned(), arguments: vec![] };
                    }
                };
                command.run()?;

                Ok(ResponseMessage::SiteLaunched)
            }

            RequestMessage::InstallSite {
                manifest_url,
                document_url,
                start_url,
                profile,
                name,
                description,
                categories,
                keywords,
            } => {
                // Just simulate calling site install command
                let command = SiteInstallCommand {
                    manifest_url: manifest_url.to_owned(),
                    document_url: document_url.to_owned(),
                    start_url: start_url.to_owned(),
                    profile: profile.to_owned(),
                    name: name.to_owned(),
                    description: description.to_owned(),
                    categories: categories.to_vec(),
                    keywords: keywords.to_vec(),
                    system_integration: true,
                };
                let ulid = command._run()?;

                Ok(ResponseMessage::SiteInstalled(ulid))
            }

            RequestMessage::UninstallSite(id) => {
                // Just simulate calling site uninstall command
                let command = SiteUninstallCommand { id: *id, quiet: true };
                command.run()?;

                Ok(ResponseMessage::SiteUninstalled)
            }

            RequestMessage::UpdateSite {
                id,
                start_url,
                name,
                description,
                categories,
                keywords,
                manifest_updates,
                system_integration,
            } => {
                // Just simulate calling site update command
                let command = SiteUpdateCommand {
                    id: *id,
                    start_url: start_url.to_owned(),
                    name: name.to_owned(),
                    description: description.to_owned(),
                    categories: categories.to_owned(),
                    keywords: keywords.to_owned(),
                    update_manifest: *manifest_updates,
                    update_icons: true, // TODO: Implement icon update switch
                    system_integration: *system_integration,
                    store_none_values: true,
                };
                command.run()?;

                Ok(ResponseMessage::SiteUpdated)
            }

            RequestMessage::UpdateAllSites { manifest_updates, system_integration } => {
                let dirs = ProjectDirs::new()?;
                let mut storage = Storage::load(&dirs)?;

                for site in storage.sites.values_mut() {
                    info!("Updating web app {}", site.ulid);

                    if *manifest_updates {
                        site.update().context("Failed to update web app manifest")?;
                    }

                    if *system_integration {
                        site.install_system_integration(&dirs)
                            .context("Failed to update system integration")?;
                    }
                }

                storage.write(&dirs)?;
                Ok(ResponseMessage::AllSitesUpdated)
            }

            RequestMessage::GetProfileList => {
                // Return profile list from storage
                Ok(ResponseMessage::ProfileList(self.storage.profiles.to_owned()))
            }

            RequestMessage::CreateProfile { name, description } => {
                // Just simulate calling profile create command
                let command = ProfileCreateCommand {
                    name: name.to_owned(),
                    description: description.to_owned(),
                };
                let ulid = command._run()?;

                Ok(ResponseMessage::ProfileCreated(ulid))
            }

            RequestMessage::RemoveProfile(id) => {
                // Just simulate calling profile remove command
                let command = ProfileRemoveCommand { id: *id, quiet: true };
                command.run()?;

                Ok(ResponseMessage::ProfileRemoved)
            }

            RequestMessage::UpdateProfile { id, name, description } => {
                // Just simulate calling profile update command
                let command = ProfileUpdateCommand {
                    id: *id,
                    name: name.to_owned(),
                    description: description.to_owned(),
                    store_none_values: true,
                };
                command.run()?;

                Ok(ResponseMessage::ProfileUpdated)
            }

            RequestMessage::GetConfig => {
                // Return config from storage
                Ok(ResponseMessage::Config(self.storage.config.to_owned()))
            }

            RequestMessage::SetConfig(config) => {
                // Overwrite existing config and write it to storage
                let mut storage = self.storage.to_owned();
                storage.config = config.to_owned();
                storage.write(self.dirs)?;
                Ok(ResponseMessage::ConfigSet)
            }
        }
    }
}
