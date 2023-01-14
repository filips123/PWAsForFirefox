Progressive Web Apps for Firefox - Native
=========================================

The native part of the PWAsForFirefox project.

## Description

The native part is written in Rust and handles the parts that the extension cannot do alone. This includes installing Firefox runtime, patching it with the chrome modifications, installing the sites, and launching them. This can be done via the `firefoxpwa` console program, or via the browser extension that connects with this program using native messaging protocol for easier use.

The native part also contains browser chrome (UI) modifications written in JS and CSS to make the browser work as a standalone PWA: Hiding tab and address bar, re-arranging widgets, handling the web app scope, and applying system integration.

Read [the main README file](../README.md) for more details about the project.

## Installation

### Supported Operating Systems

* Windows (pre-built MSI installer)
* Debian-like Linux (pre-built DEB package)
* Red Hat-like Linux (pre-built RPM package)
* Arch-like Linux (source and binary AUR packages)
* Other Linux (source installation only)
* macOS (bottled Homebrew formula)

### Requirements

* Windows: [Visual C++ Redistributable](https://support.microsoft.com/en-us/help/2977003/the-latest-supported-visual-c-downloads)
* macOS: Xcode Command Line Tools
* Linux: `glibc` 2.18 or later

### From Package Repositories

#### Packagecloud.io

The DEB and RPM packages are hosted on [the packagecloud.io repository](https://packagecloud.io/filips/FirefoxPWA). You can enable this repository and install packages from there if you prefer to manage PWAsForFirefox updates using your system package manager.

Thanks to [packagecloud.io](https://packagecloud.io/) for sponsoring this project and providing us a free hosting for our DEB and RPM packages!

#### Standard Repositories

<details>
  <summary>Expand packaging status</summary>

[![Packaging status](https://repology.org/badge/vertical-allrepos/firefoxpwa.svg)](https://repology.org/project/firefoxpwa/versions)
</details>

* Windows Package Manager: `filips.FirefoxPWA`
* Chocolatey: [`firefoxpwa`](https://community.chocolatey.org/packages/firefoxpwa)
* Npackd: [`firefoxpwa`](https://www.npackd.org/p/firefoxpwa)
* Homebrew: [`firefoxpwa`](https://formulae.brew.sh/formula/firefoxpwa)
* Arch User Repository: [`firefox-pwa`](https://aur.archlinux.org/packages/firefox-pwa/) (source)
* Arch User Repository: [`firefox-pwa-bin`](https://aur.archlinux.org/packages/firefox-pwa-bin/) (pre-built)

*Note:* If you want to package PWAsForFirefox for your distribution or package manager, or have already packaged it, please let me know, so I can help with the packaging and list it in the installation instructions. If the packaging platform supports any auto-submission/uploading feature, please also let me know, as I might integrate it directly with GitHub Actions to make sure the packages are always up-to-date.

### From Release Binaries

You can download installers/packages and the shell completions from [the latest GitHub release](https://github.com/filips123/PWAsForFirefox/releases/latest).

### From Development Binaries

You can download and install [the latest build artifact](https://github.com/filips123/PWAsForFirefox/actions/workflows/native.yaml?query=actor%3Afilips123) from GitHub Actions builds. Note that these are development versions that may be unstable.

### From Source

First, you will need make sure you have the following tools installed:

* Git
* Rust
* [`cargo-make`](https://github.com/sagiegurari/cargo-make)
* Windows-only: [WiX Toolset](https://wixtoolset.org/releases/)

You can then run the following commands to build and install it using `cargo-make`:

```shell
# Clone the repository and switch into the correct directory
git clone https://github.com/filips123/PWAsForFirefox.git
cd PWAsForFirefox/native

# If building a specific version
# Set the VERSION environment variable
# And run the following commands to set version
git checkout tags/v${VERSION}
sed -i "s/version = \"0.0.0\"/version = \"$VERSION\"/g" Cargo.toml
sed -i "s/DISTRIBUTION_VERSION = '0.0.0'/DISTRIBUTION_VERSION = '$VERSION'/g" userchrome/profile/chrome/pwa/chrome.jsm

# Build and install the project
makers install
```

Alternatively, you can:

* Use [`cargo-wix`](https://github.com/volks73/cargo-wix) to build the MSI installer.
* Use [`cargo-deb`](https://github.com/kornelski/cargo-deb) to build the DEB package.
* Use [`cargo-rpm`](https://github.com/iqlusioninc/cargo-rpm) to build the RPM package.

If you want to modify the installation or runtime directory, you will also need to modify the source code before building. Check [the FAQ in the repository wiki](https://github.com/filips123/PWAsForFirefox/wiki/Frequently-Asked-Questions) for more details.

## Usage

### Runtime Management

Before you can use this project, you need to download and install Firefox browser runtime:

```shell
firefoxpwa runtime install
```

The runtime will be completely separated from your main Firefox installation.

To install runtime on Windows, you will need [7-Zip](https://7-zip.org/) installed. Installing the runtime will automatically trigger the 7-Zip installer if needed. This may require accepting User Account Control prompt. You can also manually install 7-Zip or use your existing 7-zip installation. After the runtime is installed, you can delete 7-Zip manually.

You can also uninstall the runtime, but you won't be able to use this project again until you install it back:

```shell
firefoxpwa runtime uninstall
```

### Profile Management

By default, all web apps will be installed to a common profile with ID `00000000000000000000000000`. You can also create separate isolated profiles and install web apps there. This means you can also install multiple instances of the same web app with different accounts.

* To create a new separate profile:

  ```shell
  firefoxpwa profile create --name PROFILE-NAME --description PROFILE-DESCRIPTION
  ```

  Both the name and description arguments are optional. This will create a new profile directory and return its ID. You will need that ID to later install the web apps into a profile or remove it.

* To remove an existing profile:

  ```shell
  firefoxpwa profile remove ID
  ```

  This will completely remove the profile and all web apps installed in it, including all user data. You might not be able to fully recover this action. Note that a default profile cannot be completely removed, and trying to remove it will just clear all web apps and user data, but keep a profile ID in the profile list.

* To update an existing profile:

   ```shell
   firefoxpwa profile update ID --name NEW-PROFILE-NAME --description NEW-PROFILE-DESCRIPTION
   ```

  This will just change your profile name and description, while keeping the ID and all web apps intact.

* To view all available profiles and installed web apps:

  ```shell
  firefoxpwa profile list
  ```

  This will print all your profiles and web apps installed in them, including their IDs. You will need profile IDs to install a new web app into a separate profile or remove a profile, and web app IDs to launch or remove them.

### Web App Management

* To install a site as a web app:

  ```shell
  firefoxpwa site install MANIFEST-URL --profile PROFILE-ID
  ```

  The profile is optional and will default to a common profile. There are also some other options, you can check them in the program help. This will download the web app manifest, parse it and register the web app to the OS. It will also return the web app ID that you will need to launch it.

* To uninstall a web app:

  ```shell
  firefoxpwa site uninstall ID
  ```

  This will uninstall the web app and remove it from the list. However, web app data will stay and will be reused if you later install it again in the same profile. To clear the data, do that through the PWA browser, or also remove a profile.

* To launch a web app:

  ```shell
  firefoxpwa site launch ID
  ```

  This will launch the Firefox browser runtime and open the web app.

### Other

This project provides shell completion files for Bash, Elvish, Fish, PowerShell, and Zsh. On Windows, all completions are installed into the `completions` directory in your chosen installation directory, but you need to manually load them into your shell. When using DEB or RPM packages or installing the package from Homebrew, completions for Bash, Fish, and Zsh are automatically installed into required directories and loaded by shells. For other operating systems or shells, you can find the pre-built completions in build artifacts or release attachments, or build them along with the project (they will be in `target/{PROFILE}/completions`).

You can also check the built-in program help (`firefoxpwa --help`).

## Contributing

Please make sure that your Rust code is properly linted and formatted using [clippy](https://github.com/rust-lang/rust-clippy) and [rustfmt](https://github.com/rust-lang/rustfmt) (nightly version).

There is currently no formatter for UserChrome JS and CSS, but may be added in the future. Please try to keep your code clean...
