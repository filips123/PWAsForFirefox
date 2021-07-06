FirefoxPWA - Extension
======================

The extension part of the FirefoxPWA project.

## Description

The extension part of the project makes it easier to install and manage Progressive Web Apps directly from the main Firefox browser. It supports installing supported PWAs with just a few clicks, managing and launching them, and creating and managing app profiles directly from the UI.

Read the [main README file](../README.md) for more details about the project.

## Installation

### From Addon Store

You should install this extension from the [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/firefoxpwa/) website.

### From Development Artifacts

You can download and install [latest build artifact](https://github.com/filips123/FirefoxPWA/actions/workflows/native.yaml) of packed extension from GitHub Actions builds. Note that these are development versions that may be unstable and are not signed, so you will need to configure Firefox to accept non-signed extensions or just load it temporarily.

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

### Setup & Update

When the extension is installed, it will automatically open a new tab with the process to set up the project. This includes accepting the license agreement, installing the native program, and installing runtime. Once the process is completed, you can start using the extension.

When the extension is updated, it will automatically open a new tab with the instructions to update the native program as well if needed. Once this is completed, you can continue using the extension.

### Installing a Site

When you open a valid PWA in the browser (that is loaded over HTTPS and has a linked web app manifest), the installation action will automatically appear in your address bar. When you click on it, the popup will appear where you can customize details about the site and install it. The installation will automatically install the PWA to the system and apply system integration.

If the site is not a valid PWA, the installation action will not appear. However, you can also install such sites from the extension's browser action. This way of installing sites does not require PWA manifest, so it should work with basically any website.

**Note:** You cannot re-use the same name for multiple PWAs, because newer ones could overwrite older start menu entries and cause problems.

**Note:** You cannot install multiple instances of the same site in the same profile, because they would actually be the same instance.

### Launching a Site

When you open a PWA which is already installed, the launch action will automatically appear in your address bar. When you click on it, the popup will appear where you can launch existing instances of the site or create a new one.

You can also launch the site through system start/app menus, or from the site list in the extension's browser action.

### Managing Sites & Profiles

You can launch, edit and remove sites, and create, edit and remove profiles, from the extension's browser action. Editing the site will also automatically update its manifest and icons. You can also search sites and profiles by their name.

**Note:** It is not recommended to rename the existing site because this can cause problems on some systems.

## Contributing

Please make sure that your JS code is properly linted and formatted using `yarn lint` (to check the code) and `yarn fix` (to automatically apply some fixes).
