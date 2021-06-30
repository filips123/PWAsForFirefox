use std::io::{Read, Write};
use std::{env, io};

use anyhow::{anyhow, Context, Result};
use byteorder::{NativeEndian, ReadBytesExt, WriteBytesExt};
use log::info;

use crate::components::runtime::Runtime;
use crate::console::app::{RuntimeInstallCommand, RuntimeUninstallCommand, SiteInstallCommand};
use crate::directories::ProjectDirs;
use crate::storage::Storage;

mod request;
mod response;

use crate::connector::request::RequestMessage;
use crate::connector::response::ResponseMessage;
use crate::console::Run;

#[derive(Debug, PartialEq, Clone)]
pub struct Connection<'a> {
    dirs: &'a ProjectDirs,
    runtime: Runtime,
    storage: Storage,
}

impl<'a> Connection<'a> {
    pub fn start(dirs: &'a ProjectDirs) -> Result<()> {
        let runtime = Runtime::new(&dirs)?;
        let storage = Storage::load(&dirs)?;

        let connection = Self { dirs, runtime, storage };
        info!("Connection established: {:?}", env::args().collect::<Vec<String>>());

        let request = connection.receive().context("Failed to receive request")?;
        info!("Received a request: {:?}", request);

        let response = connection.process(&request).context("Failed to process request")?;
        info!("Processed the request: {:?}", response);

        connection.send(&response).context("Failed to send response")?;
        info!("Sent a response");

        connection.send(&ResponseMessage::SystemVersions {
            firefoxpwa: Some("0.0.0".into()),
            firefox: None,
            _7zip: None,
        })?;

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
                {
                    // This is needed to prevent output from spawned 7Zip process
                    #[cfg(target_os = "windows")]
                    let _ = gag::Gag::stdout().context("Failed to discard stdout")?;

                    // Just simulate calling runtime install command
                    let command = RuntimeInstallCommand {};
                    command.run()?;
                }

                Ok(ResponseMessage::RuntimeInstalled)
            }

            RequestMessage::UninstallRuntime => {
                // Just simulate calling runtime install command
                let command = RuntimeUninstallCommand {};
                command.run()?;

                Ok(ResponseMessage::RuntimeUninstalled)
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
                command.run()?;

                Ok(ResponseMessage::SiteInstalled)
            }

            _ => Err(anyhow!("Unknown request")),
        }
    }
}
