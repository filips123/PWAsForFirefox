Progressive Web Apps for Firefox - Extension
============================================

The extension part of the PWAsForFirefox project.

## Description

The extension part of the project makes it easier to install and manage Progressive Web Apps directly from the main Firefox browser. It supports installing supported PWAs with just a few clicks, managing and launching them, and creating and managing app profiles directly from the UI.

Read [the main README file](../README.md) for more details about the project.

## Installation

### From Addon Store

It is recommended to install the extension from [the Firefox Add-ons website](https://addons.mozilla.org/firefox/addon/pwas-for-firefox/).

### From Development Artifacts

You can download and install [the latest build artifact](https://github.com/filips123/PWAsForFirefox/actions/workflows/extension.yaml) from GitHub Actions builds.

Note that these are development versions that may be unstable and are not signed, so you will need to configure Firefox to accept non-signed extensions or just load it temporarily. It is generally not recommended to use them, unless you are testing a specific unreleased feature.

### From Source

1. Install Node.js and Yarn package manager.

2. Clone the repository and cd into the `extension` (this) directory.

3. If building a specific version:
    1. Checkout the correct Git tag.
    2. Modify `version` field inside `package.json` to the correct version.
    3. Modify `version` field inside `src/manifest.json` to the correct version.

4. Either:

   a. Run `yarn build` to build the extension in release mode and package it.

   b. Run `yarn watch` to build the extension in development mode and automatically rebuild it on any changes.

5. Either:

   a. Install the packaged extension from `dist/firefoxpwa-{version}.zip` in `about:debugging`.

   b. Install the development extension from `dist/manifest.json` in `about:debugging`.

## Usage

### Setup & Update

When the extension is installed, it will automatically open a new tab with the process to set up the project. This includes accepting the license agreement, installing the native program, and installing runtime. Once the process is completed, you can start using the extension.

When the extension is updated, it will automatically open a new tab with the instructions to update the native program as well if needed. Once this is completed, you can continue using the extension.

### Installing a Web App

When you open a website that is a valid PWA (is loaded over HTTPS and has a linked web app manifest), the installation action will automatically appear in your address bar. When you click on it, the popup will appear where you can customize details about the web app and install it.

If the website is not a valid PWA, the installation action will not appear. However, you can also install such websites from the extension's browser action. This way of installing web apps does not require a web app manifest, so it should work with basically any website.

**Warning:** On Linux and macOS, all web apps that are opened at the same time will be merged with the first web app that was opened. You can prevent this by installing each web app into a separate profile. Check [the current limitations](../README.md#current-limitations) section for more details.

**Note:** If the installation fails because of a manifest-related error, you can try disabling the use of manifest for determining app properties and installing it again.

**Note:** You cannot re-use the same name for multiple web apps, because newer ones could overwrite older start menu entries and cause problems.

**Note:** You cannot install multiple instances of the same web app in the same profile, because they would actually be the same instance.

### Launching a Web App

When you open a website which has already been installed, the launch action will automatically appear in your address bar. When you click on it, the popup will appear where you can launch existing instances of the web app or create a new one.

You can also launch the web app through system start/app menus, or from the web app list in the extension's browser action.

### Managing Web Apps & Profiles

You can launch, edit and remove web apps, and create, edit and remove profiles, from the extension's browser action. Editing a web app will also automatically update its manifest and icons. You can also search web apps and profiles by their name.

## Contributing

Please make sure that your JS code is properly linted and formatted using `yarn lint` (to check the code) and `yarn fix` (to automatically apply some fixes).
