use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::process::exit;
use std::{env, io};

use anyhow::{Context, Result};
use byteorder::{NativeEndian, ReadBytesExt, WriteBytesExt};
use log::{error, info};

use crate::connector::process::Process;
use crate::connector::request::ConnectorRequest;
use crate::connector::response::ConnectorResponse;
use crate::directories::ProjectDirs;

mod process;
mod request;
mod response;

#[derive(Debug, Clone)]
pub struct Connection<'a> {
    dirs: &'a ProjectDirs,
    debugmode: bool,
}

impl<'a> Connection<'a> {
    pub fn start(dirs: &'a ProjectDirs, debugmode: bool) -> Result<()> {
        let connection = Self { dirs, debugmode };
        info!("Connection established: {:?}", env::args().collect::<Vec<String>>());

        // Wrapped into a closure to emulate currently unstable `try` blocks
        let handle = || -> Result<ConnectorResponse> {
            let request = connection.receive().context("Failed to receive request")?;
            info!("Received a request: {:?}", request);

            let response = connection.process(&request).context("Failed to process request")?;
            info!("Processed the request: {:?}", response);

            Ok(response)
        };

        // Handle the connection and send the response
        match handle() {
            Ok(response) => {
                // Everything seems to be fine
                // Just send the response back
                connection.send(&response).context("Failed to send response")?;
                info!("Sent a response");
            }
            Err(error) => {
                // There was some error while processing the request
                // Pack it into a custom response message and send it back
                error!("{:?}", error);

                // We need a bit special handling to skip the first error
                let cause: String = error
                    .chain()
                    .skip(1)
                    .map(|cause| cause.to_string())
                    .collect::<Vec<String>>()
                    .join(": ");

                let response = ConnectorResponse::Error(cause);
                connection.send(&response).context("Failed to send response")?;
                info!("Sent a response");
                exit(1);
            }
        }
        Ok(())
    }

    fn receive(&self) -> Result<ConnectorRequest> {
        let size = io::stdin().read_u32::<NativeEndian>().context("Failed to read message size")?;
        let mut buffer = vec![0u8; size as usize];

        io::stdin().read_exact(&mut buffer).context("Failed to read message")?;
        serde_json::from_slice(&buffer).context("Failed to deserialize message")
    }

    fn send(&self, response: &ConnectorResponse) -> Result<()> {
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

    fn process(&self, request: &ConnectorRequest) -> Result<ConnectorResponse> {
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
        request.process(self)
    }
}
