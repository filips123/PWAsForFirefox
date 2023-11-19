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
* BSD (source installation only)

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
* Scoop: [`extras/firefoxpwa`](https://scoop.sh/#/apps?q=firefoxpwa&id=5361097c7301cc92340840a5f3970aca9220100d)
* Homebrew: [`firefoxpwa`](https://formulae.brew.sh/formula/firefoxpwa)
* Arch User Repository: [`firefox-pwa`](https://aur.archlinux.org/packages/firefox-pwa/) (source)
* Arch User Repository: [`firefox-pwa-bin`](https://aur.archlinux.org/packages/firefox-pwa-bin/) (pre-built)
* Gentoo GURU: [`www-plugins/firefoxpwa`](https://gpo.zugaina.org/Overlays/guru/www-plugins/firefoxpwa)

> [!NOTE]
> If you want to package PWAsForFirefox for your distribution or package manager, or have already packaged it, please let me know, so I can help with the packaging and list it in the installation instructions. If the packaging platform supports any auto-submission/uploading feature, please also let me know, as I might integrate it directly with GitHub Actions to make sure the packages are always up-to-date.

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
makers set-version ${VERSION}

# Build and install the project
makers install
```

Alternatively, you can:

* Use [`cargo-wix`](https://github.com/volks73/cargo-wix) to build the MSI installer.
* Use [`cargo-deb`](https://github.com/kornelski/cargo-deb) to build the DEB package.
* Use [`cargo-rpm`](https://github.com/filips123/cargo-rpm) to build the RPM package.

If you want to modify the installation or runtime directory, please check [our FAQ page](https://pwasforfirefox.filips.si//help/faq/#how-to-install-this-project-to-a-different-location) for more details.

## Usage

You can read [our documentation website](https://pwasforfirefox.filips.si/user-guide/console/) for usage instructions.

## Contributing

Please make sure that your Rust code is properly linted and formatted using [clippy](https://github.com/rust-lang/rust-clippy) and [rustfmt](https://github.com/rust-lang/rustfmt) (nightly version).

There is currently no formatter for UserChrome JS and CSS, but may be added in the future. Please try to keep your code clean...
