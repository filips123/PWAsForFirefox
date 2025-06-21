use std::fs::File;
use std::io::Read;
use std::path::PathBuf;

use anyhow::{Context, Result};
use log::warn;
use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue};
use reqwest::Certificate;

const APP_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0";

/// Load DER and PEM certificates from files.
///
/// # Parameters
///
/// - `certificates_der` - A list of paths to DER certificate files.
/// - `certificates_pem` - A list of paths to PEM certificate files.
///
pub fn load_certificates(
    certificates_der: &Option<Vec<PathBuf>>,
    certificates_pem: &Option<Vec<PathBuf>>,
) -> Result<Vec<Certificate>> {
    const CERT_READ_ERROR: &str = "Failed to read certificate";
    const CERT_PARSE_ERROR: &str = "Failed to parse certificate";

    let mut certs = vec![];

    for path in certificates_der.iter().flatten() {
        let mut buf = vec![];
        File::open(path)
            .context(CERT_READ_ERROR)?
            .read_to_end(&mut buf)
            .context(CERT_READ_ERROR)?;
        let cert = Certificate::from_der(&buf).context(CERT_PARSE_ERROR)?;
        certs.push(cert);
    }

    for path in certificates_pem.iter().flatten() {
        let mut buf = vec![];
        File::open(path)
            .context(CERT_READ_ERROR)?
            .read_to_end(&mut buf)
            .context(CERT_READ_ERROR)?;
        let cert = Certificate::from_pem(&buf).context(CERT_PARSE_ERROR)?;
        certs.push(cert);
    }

    Ok(certs)
}

/// Construct a HTTP client with additional parameters.
///
/// # Parameters
///
/// - `user_agent` - A custom user-agent header.
/// - `root_certificates` - A list of additional root certificates.
/// - `danger_accept_invalid_certs` - Whether the client accepts invalid certs (dangerous).
/// - `danger_accept_invalid_hostnames` - Whether the client accepts invalid hostnames (dangerous).
///
pub fn construct_client(
    user_agent: Option<&str>,
    root_certificates: Vec<Certificate>,
    danger_accept_invalid_certs: bool,
    danger_accept_invalid_hostnames: bool,
) -> reqwest::Result<Client> {
    let mut headers = HeaderMap::new();
    headers.insert("Sec-Fetch-Site", HeaderValue::from_static("none"));
    headers.insert("Sec-Fetch-Dest", HeaderValue::from_static("manifest"));

    let mut builder = Client::builder()
        .user_agent(user_agent.unwrap_or(APP_USER_AGENT))
        .default_headers(headers)
        .danger_accept_invalid_certs(danger_accept_invalid_certs)
        .danger_accept_invalid_hostnames(danger_accept_invalid_hostnames);

    if danger_accept_invalid_certs || danger_accept_invalid_hostnames {
        warn!("Certificate or hostname verification is disabled");
        warn!("This is a dangerous option that should be used with care");
    }

    for certificate in root_certificates {
        builder = builder.add_root_certificate(certificate);
    }

    builder.build()
}

/// Load certificates from files and constructs a HTTP client with them.
///
/// See [load_certificates] and [construct_client] for more
/// details and description of function parameters.
///
pub(crate) fn construct_certificates_and_client(
    user_agent: Option<&str>,
    certificates_der: &Option<Vec<PathBuf>>,
    certificates_pem: &Option<Vec<PathBuf>>,
    danger_accept_invalid_certs: bool,
    danger_accept_invalid_hostnames: bool,
) -> Result<Client> {
    const CLIENT_CERT_ERROR: &str = "Failed to load HTTP client certificates";
    const CLIENT_CONSTRUCT_ERROR: &str = "Failed to construct HTTP client";

    construct_client(
        user_agent,
        load_certificates(certificates_der, certificates_pem).context(CLIENT_CERT_ERROR)?,
        danger_accept_invalid_certs,
        danger_accept_invalid_hostnames,
    )
    .context(CLIENT_CONSTRUCT_ERROR)
}

/// Remove all control characters from the string.
pub fn sanitize_string(string: &str) -> String {
    string.chars().filter(|char| !char.is_control()).collect()
}
