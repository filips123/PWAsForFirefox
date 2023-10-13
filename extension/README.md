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

3. Run `yarn install` to install the dependencies

4. If building a specific version:
    1. Checkout the correct Git tag.
    2. Run `yarn set-version` to add the version information to the configuration files.

5. Either:

   a. Run `yarn build` to build the extension in release mode and package it.

   b. Run `yarn watch` to build the extension in development mode and automatically rebuild it on any changes.

6. Either:

   a. Install the packaged extension from `dist/firefoxpwa-{version}.zip` in `about:debugging`.

   b. Install the development extension from `dist/manifest.json` in `about:debugging`.

## Usage

You can read [our documentation website](https://pwasforfirefox.filips.si/user-guide/extension/) for usage instructions.

## Contributing

Please make sure that your JS code is properly linted and formatted using `yarn lint` (to check the code) and `yarn fix` (to automatically apply some fixes).
