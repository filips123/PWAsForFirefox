# Frequently Asked Questions

## How to install this project?

You can read [the installation page](../installation/requirements.md) for the installation
instructions. Instructions for installing the native program are also displayed directly
in the extension setup wizard. For usage instructions, you can check
[the user guide](../user-guide/extension.md).

## How to use install this project with PortableApps.com?

The project provides a portable installer (`.paf.exe`), which can be downloaded from the
GitHub Releases page. It is recommended to install it through the PortableApps.com
Platform for additional integration with its app menu.

Before being able to use the browser extension with the portable version, you will have
to start PWAsForFirefox Portable. This will launch a small background program that makes
sure the browser is connected to the portable version. This program can be closed from
the taskbar tray icon when you do not need it.

## How to install this project to a different location?

You can customize install locations for most directories using build-time environment
variables. However, this will only change where the program expects the files to be, and
you will need to manually copy the files to the correct locations. You will also need to
manually edit the native app manifest with the correct path to the connector.

Descriptions of each directory, their default locations, and a list of environment
variables to change them are available [on the directories page](installation-directories.md).
If you want to specify a location in the home directory, start the environment variable
with `~/`, and it will be expanded to the user home directory at the run-time.

## How to install the browser runtime to a different location?

If you want to change the locations of all directories, see the above question.
Otherwise, you will need to manually edit [the source code](https://github.com/filips123/PWAsForFirefox/blob/main/native/src/components/runtime.rs#L78-L89).

## How to use an alternative browser as a main browser?

The extension should work with most actively-developed Firefox-based browsers or forks.
However, some of them have different search locations for native messaging manifests, so
the extension might not detect the native program. You will need to check the documentation
of your browser for specific manifest locations and copy the manifest to the correct one.

## How to use an alternative browser as an app browser?

Instead of using the default runtime (normal Firefox), you can manually download an
alternative Firefox version or Firefox fork (LibreWolf, IceCat, Waterfox, etc.). However,
please keep in mind that compatibility with other or unofficial runtimes is not guaranteed.

To apply UserChrome modifications to the new runtime, you may need to temporarily enable
[Always patch runtime and profile](../user-guide/extension.md#always-patch-runtime-and-profile)
and then launch any web app.

=== "Generic"

    1. Download the "portable" archive (binary tarball) for your preferred Firefox-based browser.
    2. Extract downloaded archive and copy files [to the runtime directory](./installation-directories.md#runtime).
    3. Inside that directory, symlink the main binary of your browser as `firefox.exe`/`firefox`.

=== "LibreWolf"

    === "Windows"

        1. Create [an empty runtime directory](./installation-directories.md#runtime) (or clear it if it already exists).
        2. Download [the latest `.win64-portable.zip` file](https://gitlab.com/librewolf-community/browser/windows/-/releases) from the LibreWolf releases.
        3. Extract file and copy **content** of `librewolf-VERSION\LibreWolf` to the runtime directory.
        4. Open Command Line in that directory and run `mklink firefox.exe librewolf.exe`.

    === "Linux"

        1. Create [an empty runtime directory](./installation-directories.md#runtime) (or clear it if it already exists).
        2. Download [the latest `.x86_64.tar.bz2` file](https://gitlab.com/librewolf-community/browser/linux/-/releases) from the LibreWolf releases.
        3. Extract file and copy its **content** to the runtime directory.
        4. Open Terminal in that directory and run: `ln librewolf firefox`.

    === "macOS"

        1. Create [an empty runtime directory](./installation-directories.md#runtime) (or clear it if it already exists).
        2. Download [the latest `.dmg` file](https://gitlab.com/librewolf-community/browser/macos/-/releases) from the LibreWolf releases.
        3. Extract file and copy `LibreWolf/LibreWolf.app` to the the runtime directory.
        4. Rename `LibreWolf.app` directory in the runtime directory to `Firefox.app`.
        5. Open Terminal inside `Firefox.app/Contents/MacOS` and run: `ln librewolf firefox`.

=== "Waterfox"

    === "Windows"

        1. Create [an empty runtime directory](./installation-directories.md#runtime) (or clear it if it already exists).
        2. Download [the latest installer](https://www.waterfox.net/download/) from the Waterfox website.
        3. Do **not** run the installer. Instead, use [7-Zip](https://7-zip.org/) to extract its content.
        4. Copy the extracted **content** of `core` to the runtime directory.
        5. Open Command Line in that directory and run `mklink firefox.exe waterfox.exe`.

    === "Linux"

        1. Create [an empty runtime directory](./installation-directories.md#runtime) (or clear it if it already exists).
        2. Download [the latest tarball](https://www.waterfox.net/download/) from the Waterfox website.
        3. Extract file and copy `waterfox` to the runtime directory.
        4. Open Terminal in that directory and run: `ln waterfox firefox`.

    === "macOS"

        1. Create [an empty runtime directory](./installation-directories.md#runtime) (or clear it if it already exists).
        2. Download [the latest disk image](https://www.waterfox.net/download/) from the Waterfox website.
        3. Extract file and copy `Waterfox/Waterfox.app` to the the runtime directory.
        4. Rename `Waterfox.app` directory in the runtime directory to `Firefox.app`.
        5. Open Terminal inside `Firefox.app/Contents/MacOS` and run: `ln waterfox firefox`.

## How to install addons to the app browser?

You can open the built-in addon manager using a standard keyboard shortcut or the
app menu. You can also navigate to the addon store by opening the URL input (by
pressing ++f6++, ++ctrl+l++ or ++alt+d++) and entering `addons.mozilla.org`.

## Why can't I install a specific website I want?

If you are building a development extension build yourself, the auto-reloading feature may
prevent the extension from running on certain websites. To be able to install such
websites, you either need to build a production build or use a pre-built extension.

[Some Mozilla websites](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts)
block extension content scripts for security reasons. You cannot install that sites using
the extension. However, you may be able to install them manually using the command-line
program.

Some websites cannot be installed with the manifest enabled because their manifests are
invalid or do not follow the specifications properly. To install such websites, you can
try disabling the use of manifest for determining the app properties. We maintain
[a list of those websites](../resources/specific-website-tips.md#websites-with-invalid-manifests).

If the website is not a valid PWA, the page action (in the address bar) will not appear by
default. However, you can install such websites from the main extension/browser action
(the same place where all installed web apps are listed). This way of installing sites
does not require PWA manifest, so it should work with basically any website.

Otherwise, you can check [the troubleshooting guide](./troubleshooting.md) and create
a new issue if needed.

**TODO: Check what needs to be added to FAQ:**

* Better documentation for LibreWolf (#323)
* Problems on Ubuntu (#325)
* Other things?

**TODO: Should FAQ questions be grouped into categories?**
