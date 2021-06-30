FirefoxPWA - Extension
======================

The extension part of the FirefoxPWA project.

## Description

The extension part of the project makes it easier to install and manage Progressive Web Apps directly from the main Firefox browser. It supports installing supported PWAs with just a few clicks, ~~creating and managing app profiles, and launching, updating, removing and managing installed apps directly from the UI~~.

Read the [main README file](../README.md) for more details about the project.

## Installation

### From Addon Store

Currently not available.

### From Release Artifacts

You can download the packed extension from the [latest GitHub release](https://github.com/filips123/FirefoxPWA/releases/latest). Note that it is not signed, so you will need to configure Firefox to accept non-signed extensions or just load it temporarily.

### From Development Binaries

You can download and install [latest build artifact](https://github.com/filips123/FirefoxPWA/actions/workflows/native.yaml) of packed extension from GitHub Actions builds. Note that these are development versions that may be unstable, and are not signed, so you will need to configure Firefox to accept non-signed extensions or just load it temporarily.

### From Source

1. Install Node.js and Yarn package manager.
   
2. Clone the repository and cd into the `extension` (this) directory.
   
3. Either:
   
   a. Run `yarn build` to build the extension in release mode and package it.

   b. Run `yarn watch` to build the extension in development mode and automatically rebuild it on any changes.

4. Either:
   
   a. Install the packaged extension from `dist/firefoxpwa-{version}.zip` in `about:debugging`.
   
   b. Install the development extension from `dist/debug/manifest.json` in `about:debugging`.

## Usage

# Setup & Update

When the extension is installed, it will automatically open a new tab with the process to set up the project. This includes accepting license agreement, installing the native program and installing runtime. Once the process is completed, you can start using the extension.

When the extension is updated, it will automatically open a new tab with the instructions to update the native program as well if needed. Once this is completed, you can continue using the extension.

# Launching a Site

Currently not available from the extension. Launch it directly from your system start/app menu or using the console program.

# Installing a Site

When you open a valid PWA in the browser (that is loaded over HTTPS and has linked web app manifest), the site installation action will automatically appear in your address bar. When you click on it, the popup will appear where you can customize details about the site and install it. Installation will automatically install the PWA to the system and apply system integration.

It is currently not possible to install PWA into non-default profile, but it will be in the future. Until them, you can install PWA into non-default profile using the console program.

**Important:** You should not re-use the same name for multiple PWAs, otherwise, newer ones will overwrite older start menu entries and cause problems.

# Uninstalling a Site

Currently not available from the extension. Uninstall it directly from Add or Remove Programs system page (if on Windows) or using the console program.

# Managing Sites

Currently not available from the extension. Manage them using the console program.

## Contributing

Please make sure that your JS code is properly linted and formatted using `yarn lint` (to check the code) and `yarn fix` (to automatically apply some fixes).
