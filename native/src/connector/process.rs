use anyhow::{bail, Context, Result};
use cfg_if::cfg_if;
use log::info;

use crate::components::runtime::Runtime;
use crate::connector::request::{
    CreateProfile,
    GetConfig,
    GetProfileList,
    GetSiteList,
    GetSystemVersions,
    InstallRuntime,
    InstallSite,
    LaunchSite,
    RegisterProtocolHandler,
    RemoveProfile,
    SetConfig,
    UninstallRuntime,
    UninstallSite,
    UnregisterProtocolHandler,
    UpdateAllSites,
    UpdateProfile,
    UpdateSite,
};
use crate::connector::response::ConnectorResponse;
use crate::connector::Connection;
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
use crate::integrations;
use crate::integrations::IntegrationInstallArgs;
use crate::storage::Storage;
use crate::utils::construct_certificates_and_client;

pub trait Process {
    fn process(&self, connection: &Connection) -> Result<ConnectorResponse>;
}

impl Process for GetSystemVersions {
    fn process(&self, connection: &Connection) -> Result<ConnectorResponse> {
        Ok(ConnectorResponse::SystemVersions {
            firefoxpwa: Some(env!("CARGO_PKG_VERSION").into()),
            firefox: Runtime::new(connection.dirs)?.version,
            _7zip: {
                cfg_if! {
                    if #[cfg(target_os = "windows")] {
                        use crate::components::_7zip::_7Zip;
                        _7Zip::new()?.version
                    } else {
                        None
                    }
                }
            },
        })
    }
}

impl Process for GetConfig {
    fn process(&self, connection: &Connection) -> Result<ConnectorResponse> {
        let storage = Storage::load(connection.dirs)?;
        Ok(ConnectorResponse::Config(storage.config))
    }
}

impl Process for SetConfig {
    fn process(&self, connection: &Connection) -> Result<ConnectorResponse> {
        let mut storage = Storage::load(connection.dirs)?;
        storage.config = self.0.to_owned();
        storage.write(connection.dirs)?;
        Ok(ConnectorResponse::ConfigSet)
    }
}

impl Process for InstallRuntime {
    fn process(&self, _connection: &Connection) -> Result<ConnectorResponse> {
        let command = RuntimeInstallCommand {};
        command.run()?;

        Ok(ConnectorResponse::RuntimeInstalled)
    }
}

impl Process for UninstallRuntime {
    fn process(&self, _connection: &Connection) -> Result<ConnectorResponse> {
        let command = RuntimeUninstallCommand {};
        command.run()?;

        Ok(ConnectorResponse::RuntimeUninstalled)
    }
}

impl Process for GetSiteList {
    fn process(&self, connection: &Connection) -> Result<ConnectorResponse> {
        let storage = Storage::load(connection.dirs)?;
        Ok(ConnectorResponse::SiteList(storage.sites))
    }
}

impl Process for LaunchSite {
    fn process(&self, _connection: &Connection) -> Result<ConnectorResponse> {
        cfg_if! {
            if #[cfg(target_os = "macos")] { let command = SiteLaunchCommand { id: self.id, url: self.url.to_owned(), protocol: None, arguments: vec![], direct_launch: false }; }
            else { let command = SiteLaunchCommand { id: self.id, url: self.url.to_owned(), protocol: None, arguments: vec![] }; }
        };
        command.run()?;

        Ok(ConnectorResponse::SiteLaunched)
    }
}

impl Process for InstallSite {
    fn process(&self, _connection: &Connection) -> Result<ConnectorResponse> {
        let command = SiteInstallCommand {
            manifest_url: self.manifest_url.to_owned(),
            document_url: self.document_url.to_owned(),
            start_url: self.start_url.to_owned(),
            icon_url: self.icon_url.to_owned(),
            profile: self.profile.to_owned(),
            name: self.name.to_owned(),
            description: self.description.to_owned(),
            categories: self.categories.to_owned(),
            keywords: self.keywords.to_owned(),
            system_integration: true,
            client: self.client.to_owned().into(),
        };
        let ulid = command._run()?;

        Ok(ConnectorResponse::SiteInstalled(ulid))
    }
}

impl Process for UninstallSite {
    fn process(&self, _connection: &Connection) -> Result<ConnectorResponse> {
        let command = SiteUninstallCommand { id: self.id, quiet: true, system_integration: true };
        command.run()?;

        Ok(ConnectorResponse::SiteUninstalled)
    }
}

impl Process for UpdateSite {
    fn process(&self, _connection: &Connection) -> Result<ConnectorResponse> {
        // `categories` and `keywords` need some weird hack to be compatible with Clap
        // See [`crate::console::store_value_vec`] for more details
        let command = SiteUpdateCommand {
            id: self.id,
            start_url: self.start_url.to_owned(),
            icon_url: self.icon_url.to_owned(),
            name: self.name.to_owned(),
            description: self.description.to_owned(),
            categories: self.categories.clone().map(|x| x.unwrap_or_else(|| vec!["".into()])),
            keywords: self.keywords.clone().map(|x| x.unwrap_or_else(|| vec!["".into()])),
            enabled_url_handlers: self.enabled_url_handlers.to_owned(),
            enabled_protocol_handlers: self.enabled_protocol_handlers.to_owned(),
            update_manifest: self.update_manifest,
            update_icons: self.update_icons,
            system_integration: true,
            client: self.client.to_owned().into(),
        };
        command.run()?;

        Ok(ConnectorResponse::SiteUpdated)
    }
}

impl Process for UpdateAllSites {
    fn process(&self, connection: &Connection) -> Result<ConnectorResponse> {
        let mut storage = Storage::load(connection.dirs)?;

        for site in storage.sites.values_mut() {
            info!("Updating web app {}", site.ulid);
            let old_name = site.name();

            let client = construct_certificates_and_client(
                &self.client.tls_root_certificates_der,
                &self.client.tls_root_certificates_pem,
                self.client.tls_danger_accept_invalid_certs,
                self.client.tls_danger_accept_invalid_hostnames,
            )?;

            if self.update_manifest {
                site.update(&client).context("Failed to update web app manifest")?;
            }

            integrations::install(&IntegrationInstallArgs {
                site,
                dirs: connection.dirs,
                client: Some(&client),
                update_manifest: self.update_manifest,
                update_icons: self.update_icons,
                old_name: Some(&old_name),
            })
            .context("Failed to update system integration")?;
        }

        storage.write(connection.dirs)?;
        Ok(ConnectorResponse::AllSitesUpdated)
    }
}

impl Process for GetProfileList {
    fn process(&self, connection: &Connection) -> Result<ConnectorResponse> {
        let storage = Storage::load(connection.dirs)?;
        Ok(ConnectorResponse::ProfileList(storage.profiles))
    }
}

impl Process for CreateProfile {
    fn process(&self, _connection: &Connection) -> Result<ConnectorResponse> {
        let command = ProfileCreateCommand {
            name: self.name.to_owned(),
            description: self.description.to_owned(),
            template: self.template.to_owned(),
        };
        let ulid = command._run()?;

        Ok(ConnectorResponse::ProfileCreated(ulid))
    }
}

impl Process for RemoveProfile {
    fn process(&self, _connection: &Connection) -> Result<ConnectorResponse> {
        let command = ProfileRemoveCommand { id: self.id, quiet: true };
        command.run()?;

        Ok(ConnectorResponse::ProfileRemoved)
    }
}

impl Process for UpdateProfile {
    fn process(&self, _connection: &Connection) -> Result<ConnectorResponse> {
        let command = ProfileUpdateCommand {
            id: self.id,
            name: self.name.to_owned(),
            description: self.description.to_owned(),
        };
        command.run()?;

        Ok(ConnectorResponse::ProfileUpdated)
    }
}

impl Process for RegisterProtocolHandler {
    fn process(&self, connection: &Connection) -> Result<ConnectorResponse> {
        let mut storage = Storage::load(connection.dirs)?;
        let site = storage.sites.get_mut(&self.site).context("Web app does not exist")?;

        // Check if this protocol scheme is already used in custom or manifest handlers
        #[rustfmt::skip]
        let exists = site.config.custom_protocol_handlers.iter().any(|handler| handler.protocol == self.handler.protocol)
            || site.manifest.protocol_handlers.iter().any(|handler| handler.protocol == self.handler.protocol);
        if exists {
            bail!("Handler for this protocol scheme already exists");
        }

        // Add handler to a list of custom handlers
        site.config.custom_protocol_handlers.push(self.handler.clone());

        // If necessary, add it to a list of enabled handlers and register it to the OS
        if self.enable {
            site.config.enabled_protocol_handlers.push(self.handler.protocol.clone());

            integrations::install(&IntegrationInstallArgs {
                site,
                dirs: connection.dirs,
                client: None,
                update_manifest: false,
                update_icons: false,
                old_name: None,
            })
            .context("Failed to update system integration")?;
        }

        storage.write(connection.dirs)?;
        Ok(ConnectorResponse::ProtocolHandlerRegistered)
    }
}

impl Process for UnregisterProtocolHandler {
    fn process(&self, connection: &Connection) -> Result<ConnectorResponse> {
        let mut storage = Storage::load(connection.dirs)?;
        let site = storage.sites.get_mut(&self.site).context("Web app does not exist")?;

        // Remove handler from both lists
        site.config.enabled_protocol_handlers.retain(|it| it != &self.handler.protocol);
        site.config.custom_protocol_handlers.retain(|it| it.protocol != self.handler.protocol);

        // Unregister it from the OS
        integrations::install(&IntegrationInstallArgs {
            site,
            dirs: connection.dirs,
            client: None,
            update_manifest: false,
            update_icons: false,
            old_name: None,
        })
        .context("Failed to update system integration")?;

        storage.write(connection.dirs)?;
        Ok(ConnectorResponse::ProtocolHandlerUnregistered)
    }
}
