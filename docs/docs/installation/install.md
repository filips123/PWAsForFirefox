# Install

## Explanation

PWA's run in a discrete browser environment seperate from your normal browser sessions. To do this we need a browser that is customised for the task of running these PWA's. We install an application which loads a customised installation of Firefox to run them. Then manage all of this with a new browser extension for your existing browser. The details of both components are discussed in the sections further below as we discuss the installation process here.

## Automated

The installation has been largely simplified with the browser extension taking you through the application install. So install the exenstion first from [the Firefox Add-ons website][link-addon-store]. Then following the extension instructions.

## Manual

In some cases the extension will fail to install the necessary components so you will need to complete this step. First we need to check if the directory has been created. 

### Native Check
Check if one of the following directores exist in your system.

    Windows: %APPDATA%\FirefoxPWA
    PortableApps.com: #{root}\App\PWAsForFirefox
    Linux & BSD: ${XDG_DATA_HOME:="$HOME/.local/share"}/firefoxpwa
    macOS: $HOME/Library/Application Support/firefoxpwa

If not then you need to install the application first. See the [native] section below. Once that is done the directory should exist and the application is installed. 

#### Windows
For Windows users, open File Explorer and click on the directory name at the top. Copy and paste the following _%APPDATA%\FirefoxPWA_ into the File Explorer and press enter. If it exists the directory should appear with no errors.

### Browser install
Lastly we need to install the firefox browser we will use for running our PWA's


There are the


ther copy into a specific location.

The PWAS for Firefox is a two part package which is made up of a browse extension which talks to installed software that has 


## Supported Systems

* Windows (pre-built MSI installer)
* Debian-like Linux (pre-built DEB package)
* Red Hat-like Linux (pre-built RPM package)
* Arch-like Linux (package in `[extra]` repository)
* Gentoo-like Linux (ebuild in GURU overlay)
* NixOS Linux (nixpkgs package)
* Other Linux (source installation only)
* macOS (bottled Homebrew formula)
* BSD (source installation only)[^4]

## Extension Requirements

* Last 2 Firefox versions *OR* Firefox ESR
* Other Firefox-based browsers may also work[^1]

## Native Requirements

* Windows: [Visual C++ Redistributable](https://support.microsoft.com/en-us/help/2977003/the-latest-supported-visual-c-downloads)
* macOS: Xcode Command Line Tools[^2]
* Linux: `glibc` 2.18 or later[^3]

[^1]: Check [FAQ](../help/faq.md#how-to-use-an-alternative-browser-as-a-main-browser) for additional setup.
[^2]: Automatically installed if using Homebrew.
[^3]: Automatically installed as a package dependency.
[^4]: Support for BSD relies on XDG Desktop Entry Specification and is not regularly tested.