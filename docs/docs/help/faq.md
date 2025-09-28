# Frequently Asked Questions

<style>
.md-typeset h2 + div > h3 {
  margin-top: .8em;
}
</style>

## General

### What are Progressive Web Apps?

From [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps):

> A progressive web app (PWA) is an app that's built using web platform technologies, but
> that provides a user experience like that of a platform-specific app.
>
> Like a website, a PWA can run on multiple platforms and devices from a single codebase.
> Like a platform-specific app, it can be installed on the device, can operate while offline
> and in the background, and can integrate with the device and with other installed apps.

### What does this project do?

Although Firefox supports many of Progressive Web App APIs, it does not support functionality
to install them as a standalone system app with an app-like experience. This functionality is
often also known as a Site Specific Browser (SSB).

This project creates a custom modified Firefox runtime to allow websites to be installed as
standalone apps and provides a console tool and browser extension to install, manage and use
them. For more details about how it achieves that, you can check out [the how it works page](../about/how-it-works.md).

### How does this project compare to Chrome PWAs?

Most Chromium-based browsers have built-in support for PWAs/SSBs, which makes the initial
setup easier. In comparison, this project is made as a Firefox extension and an additional
native program, which can make the initial setup a bit more complicated, but also allows
additional features that Chromium-based browsers do not support.

Unique features that PWAsForFirefox supports include:

* **Support for separate profiles:** Although it might sometimes be more convenient to use
  the same profile for PWAs and main browsing (as this is done on Chromium), using separate
  profiles allows you to do more things that aren't possible on Chromium. This includes
  extra customization or using multiple accounts for the same web app.

* **More customization options:** This project supports additional configuration abilities
  that Chromium-based browsers do not. Customization options that the project supports include
 allowing the customization of the browser toolbar with widgets, different browser settings
  for different web apps, installing additional addons, etc. In addition, the behavior can
  also be highly customized with the available settings.

* **Better integration with the desktop:** Web apps installed with this project can provide
  better visual and functional integration than some Chromium-based browsers. Additionally,
  the ability to customize the look using CSS allows web apps to visually match any platform.

* **Browser diversity:** Most web app runtimes are currently based on Blink/WebKit, which
  limits the web diversity. Being based on Firefox, this project provides an alternative
  runtime and promotes the browser diversity and healthier ecosystem of web platforms.

* *And more!*

## Setup

### How to install this project?

You can read [the installation page](../installation/requirements.md) for the installation
instructions. Instructions for installing the native program are also displayed directly
in the extension setup wizard. For usage instructions, you can check
[the user guide](../user-guide/extension.md).

### How to use install this project with PortableApps.com?

The project provides a portable installer (`.paf.exe`), which can be downloaded from the
GitHub Releases page. It is recommended to install it through the PortableApps.com
Platform for additional integration with its app menu.

Before being able to use the browser extension with the portable version, you will have
to start PWAsForFirefox Portable. This will launch a small background program that makes
sure the browser is connected to the portable version. This program can be closed from
the taskbar tray icon when you do not need it.

### How to install this project to a different location?

You can customize install locations for most directories using build-time environment
variables. However, this will only change where the program expects the files to be, and
you will need to manually copy the files to the correct locations. You will also need to
manually edit the native app manifest with the correct path to the connector.

Descriptions of each directory, their default locations, and a list of environment
variables to change them are available [on the directories page](../resources/installation-directories.md).
If you want to specify a location in the home directory, start the environment variable
with `~/`, and it will be expanded to the user home directory at the run-time.

### How to install the browser runtime to a different location?

If you want to install the runtime to a global directory, you can manually install the
runtime to a `runtime` directory [in the system data directory](../resources/installation-directories.md#system-data)
and remove any existing runtime in the user data directory. You also need to make sure
that the directory is writeable by all users to make the patching work.

Changing the runtime directory to other locations (unrelated to user or system data
directories) requires editing the source code.

### How to use an alternative browser as a main browser?

The extension should work with most actively-developed Firefox-based browsers or forks.
However, some of them have different search locations for native messaging manifests, so
the extension might not detect the native program. You will need to check the documentation
of your browser for specific manifest locations and copy the manifest to the correct one.

??? note "LibreWolf"

    === "Windows"

        Will already work out-of-the-box.

    === "Linux"

        You can run the following commands to symlink LibreWolf's location with Firefox's default location:

        ```shell
        ln -s ~/.mozilla/native-messaging-hosts ~/.librewolf/native-messaging-hosts
        sudo ln -s /usr/lib/mozilla/native-messaging-hosts /usr/lib/librewolf/native-messaging-hosts
        ```

        This method is recommended by [the LibreWolf documentation](https://librewolf.net/docs/faq/#how-do-i-get-native-messaging-to-work)
        and will also include other Firefox extensions that use native messaging. Alternatively,
        you can copy or symlink just the PWAsForFirefox's manifest:

        ```shell
        sudo mkdir -p /usr/lib/librewolf/native-messaging-hosts
        sudo ln -s /usr/lib/mozilla/native-messaging-hosts/firefoxpwa.json /usr/lib/librewolf/native-messaging-hosts/firefoxpwa.json
        ```

    === "macOS"

        You can run the following commands to symlink LibreWolf's location with Firefox's default location:

        ```shell
        ln -s ~/Library/Application\ Support/Mozilla/NativeMessagingHosts ~/Library/Application\ Support/LibreWolf/NativeMessagingHosts
        sudo ln -s /Library/Application\ Support/Mozilla/NativeMessagingHosts /Library/Application\ Support/LibreWolf/NativeMessagingHosts
        ```

        This method is recommended by [the LibreWolf documentation](https://librewolf.net/docs/faq/#how-do-i-get-native-messaging-to-work-1)
        and will also include other Firefox extensions that use native messaging. Alternatively,
        you can copy or symlink just the PWAsForFirefox's manifest:

        ```shell
        sudo mkdir -p /Library/Application\ Support/LibreWolf/NativeMessagingHosts
        sudo ln -s /Library/Application\ Support/Mozilla/NativeMessagingHosts/firefoxpwa.json /Library/Application\ Support/LibreWolf/NativeMessagingHosts/firefoxpwa.json
        ```

??? note "Waterfox"

    Will already work out-of-the-box.

### How to use an alternative browser as an app browser?

Instead of using the default runtime (normal Firefox), you can manually download an
alternative Firefox version or Firefox fork (LibreWolf, IceCat, Waterfox, etc.). However,
please keep in mind that compatibility with other or unofficial runtimes is not guaranteed.

To apply UserChrome modifications to the new runtime, you may need to [patch profiles and
runtime](../user-guide/extension.md#patch-profiles-and-runtime) from the extension settings.


???+ note "Generic"

    === "Windows"

        1. Download the portable archive (binary tarball) for your preferred Firefox-based browser.
        2. Extract the downloaded archive and copy files [to the runtime directory](../resources/installation-directories.md#runtime).
        3. Inside that directory, symlink the main binary of your browser as `firefox.exe`.

    === "Linux"

        1. Download the portable archive (binary tarball) for your preferred Firefox-based browser.
        2. Extract the downloaded archive and copy files [to the runtime directory](../resources/installation-directories.md#runtime).
        3. Inside that directory, symlink the main binary of your browser as `firefox`.

    === "macOS"

        1. Download the disk image for your preferred Firefox-based browser.
        2. Extract the disk image and copy the app bundle [to the runtime directory](../resources/installation-directories.md#runtime).
        3. Rename the app bundle in the runtime directory to `Firefox.app`.
        4. Inside the `Firefox.app/Contents/MacOS` directory, symlink the main binary of your browser as `firefox`.

??? note "LibreWolf"

    === "Windows"

        1. Create [an empty runtime directory](../resources/installation-directories.md#runtime) (or clear it if it already exists).
        2. Download [the latest `-windows-x86_64-portable.zip` file](https://gitlab.com/librewolf-community/browser/bsys6/-/releases) from the LibreWolf releases.
        3. Extract file and copy **content** of `librewolf-VERSION\LibreWolf` to the runtime directory.
        4. Open Command Line in that directory and run `mklink firefox.exe librewolf.exe`.

    === "Linux"

        1. Create [an empty runtime directory](../resources/installation-directories.md#runtime) (or clear it if it already exists).
        2. Download [the latest `-linux-x86_64-package.tar.bz2` file](https://gitlab.com/librewolf-community/browser/bsys6/-/releases) from the LibreWolf releases.
        3. Extract file and copy its **content** to the runtime directory.
        4. Open Terminal in that directory and run: `ln librewolf firefox`.

    === "macOS"

        1. Create [an empty runtime directory](../resources/installation-directories.md#runtime) (or clear it if it already exists).
        2. Download [the latest `-macos-x86_64-package.dmg` file](https://gitlab.com/librewolf-community/browser/bsys6/-/releases) from the LibreWolf releases.
        3. Extract file and copy `LibreWolf/LibreWolf.app` to the the runtime directory.
        4. Rename `LibreWolf.app` directory in the runtime directory to `Firefox.app`.
        5. Open Terminal inside `Firefox.app/Contents/MacOS` and run: `ln librewolf firefox`.

??? note "Waterfox"

    === "Windows"

        1. Create [an empty runtime directory](../resources/installation-directories.md#runtime) (or clear it if it already exists).
        2. Download [the latest installer](https://www.waterfox.net/download/) from the Waterfox website.
        3. Do **not** run the installer. Instead, use [7-Zip](https://7-zip.org/) to extract its content.
        4. Copy the extracted **content** of `core` to the runtime directory.
        5. Open Command Line in that directory and run `mklink firefox.exe waterfox.exe`.

    === "Linux"

        1. Create [an empty runtime directory](../resources/installation-directories.md#runtime) (or clear it if it already exists).
        2. Download [the latest tarball](https://www.waterfox.net/download/) from the Waterfox website.
        3. Extract file and copy **content** of `waterfox` to the runtime directory.
        4. Open Terminal in that directory and run: `ln waterfox firefox`.

    === "macOS"

        1. Create [an empty runtime directory](../resources/installation-directories.md#runtime) (or clear it if it already exists).
        2. Download [the latest disk image](https://www.waterfox.net/download/) from the Waterfox website.
        3. Extract file and copy `Waterfox/Waterfox.app` to the the runtime directory.
        4. Rename `Waterfox.app` directory in the runtime directory to `Firefox.app`.
        5. Open Terminal inside `Firefox.app/Contents/MacOS` and run: `ln waterfox firefox`.

### How to use FUSE OverlayFS with the app browser?

On compatible Linux distributions, it is possible to use FUSE OverlayFS to link your global
Firefox installation with the PWAsForFirefox runtime. This removes the need to manage and
store two separate Firefox installations, but requires an additional setup.

Detailed instructions are available [in the GitHub gist](https://gist.github.com/filips123/29fb511a01ee8016a927a614f32979d3#file-readme-md).

!!! warning

    Using FUSE OverlayFS is not regularly tested and may not work with all Firefox versions
    that distributions provide.

### How to make the web app titlebar look more native?

The project aims to make installed web apps look native. However, due to a large number of
Linux desktop environments and customization options, it's hard to detect them and provide
the correct built-in compatibility styles with each of them. However, there are two ways
how you can manually achieve a better visual integration with your theme.

One way of achieving the native titlebar is to disable client-side decorations (CSD) for
installed web apps. This can be done on the Firefox customized page by unchecking the
titlebar checkbox. However, this will cause a separate bar to appear, which might be
undesirable, visually unappealing and screen-inefficient.

A better solution is to manually apply custom CSS styling to customize the titlebar appearance.
See [how to apply custom CSS to web apps](#how-to-apply-custom-css-to-web-apps) and include
CSS for your platform that is provided below (you can also customize it if you want).

??? note "Windows"

    The project already includes a built-in style for Windows, so no additional CSS is
    needed. This style includes a left-aligned icon and title elements, as it is common
    on most Windows apps.

??? note "macOS"

    The project already includes a built-in style for macOS, so no additional CSS is
    needed. This style includes a centered icon and title elements and window controls
    on the left, as it is common on most macOS apps.

??? note "Linux (GNOME, Cinnamon, MATE)"

    On GNOME, Cinnamon and MATE, you can use the following CSS to remove the icon and center the title:

    ```css
    @-moz-document url('chrome://browser/content/browser.xhtml') {
      /* Horizontally center the title element */
      .site-info {
        justify-content: center !important;
      }

      /* Remove the icon element */
      .tab-icon-image {
        display: none !important;
      }

      /* Remove space between hamburger menu and window controls */
      .titlebar-spacer[type="post-tabs"] {
        width: 0 !important;
      }
    }
    ```

??? note "Linux (KDE, Xfce, LXDE, LXQt)"

    On KDE, Xfce, LXDE and LXQt, you can use the following CSS to center the title:

    ```css
    @-moz-document url('chrome://browser/content/browser.xhtml') {
      /* Horizontally center the title element */
      .site-info > .tab-label-container {
        position: relative;
        margin-left: auto;
        margin-right: auto;
        left: 9rem;
      }
    }
    ```

??? note "Linux (tiling WMs)"

    When using tiling window managers, you might want to disable the icon bar (which
    normally contains window controls and widget icons) and instead only use the
    native titlebar provided by your WM. You can do this by [allowing hiding the icon
    bar](../user-guide/browser.md#allowing-hiding-the-icon-bar) and hiding it in the
    customize page. Once disabled, you can temporarily show it using the ++ctrl+alt++
    keyboard shortcut

<!-- Those CSS snippets that center elements only center them relative to the parent -->
<!--If the user has a lot of widgets, the element might not be in the center of the window -->
<!-- I don't know if there is any CSS solution that reliably works without other problems -->

### How to make the web app titlebar use the system accent color?

On Windows, it is possible to make the web app titlebar use the system accent color
for active windows. This can be done by [applying the following custom CSS](#how-to-apply-custom-css-to-web-apps):

```css
@-moz-document url('chrome://browser/content/browser.xhtml') {
  #navigator-toolbox:not(:-moz-window-inactive),
  #scrollbutton-up:not(:hover):not(:active):not(:-moz-window-inactive),
  #scrollbutton-down:not(:hover):not(:active):not(:-moz-window-inactive),
  .tabbrowser-tab:not(:-moz-window-inactive) {
    background: AccentColor !important;
    color: AccentColorText !important;
    fill: AccentColorText !important;
  }

  #firefox-view-button[open] > .toolbarbutton-icon,
  .tab-background:is([selected], [multiselected]) {
    background-color: color-mix(in srgb, currentColor 18%, transparent) !important;
    background-image: none !important;
  }
}
```

You also need to disable [the "Allow web apps to override a theme (titlebar) color"
option](../user-guide/browser.md#allow-web-apps-to-dynamically-change-a-theme-color)
in the app browser settings to prevent conflicts with the applied styles.

!!! tip

    If you want to use the system accent color for all windows, including inactive,
    you can remove <nobr>`:not(:-moz-window-inactive)`</nobr> from the styles.

!!! note

    These styles may also work on other operating systems.

### How to apply custom CSS to web apps?

The runtime supports loading custom CSS (UserChromeCSS) in the same way as normal Firefox.
For more details and resources about custom CSS, you can check [the UserChromeCSS website](https://www.userchrome.org/).

To load custom CSS into the web app profile:

1. Locate your web app profile inside [the profiles directory](../resources/installation-directories.md#profiles).
2. Inside the profile directory, create a `chrome` directory (if it does not exist yet).
3. Inside the `chrome` directory, create a `userChrome.css` file (if it does not exist yet).
4. Copy your CSS into the `userChrome.css` file.
5. Enable `toolkit.legacyUserProfileCustomizations.stylesheets` inside `about:config`.
6. Relaunch the web app.

If you want to apply CSS to multiple profiles, using [profile templates](../user-guide/extension.md#default-profile-template)
can make this easier.

!!! warning

    As PWAsForFirefox includes its own modifications, not all Firefox CSS themes may be compatible.

### How to apply custom JS to web apps?

For advanced modifications, it is possible to load custom JS into the runtime using [UserChromeJS
(Autoconfig Startup Scripting)](https://www.userchrome.org/what-is-userchrome-js.html).

To load custom JS into the web app profile:

1. Locate your web app profile inside [the profiles directory](../resources/installation-directories.md#profiles).
2. Inside the profile directory, create a `chrome` directory (if it does not exist yet).
3. Inside the `chrome` directory, create a `user` directory (if it does not exist yet).
4. Inside the `user` directory, create a `boot.sys.mjs` file (if it does not exist yet).
5. Copy your JS into the correct file (depending on the module format).
6. Relaunch the web app.

If you want to apply JS to multiple profiles, using [profile templates](../user-guide/extension.md#default-profile-template)
can make this easier.

!!! warning

    As PWAsForFirefox includes its own modifications, not all Firefox JS scripts may be compatible.

    Such scripts are very powerful. They can modify Firefox in almost any way, and affect
    the operating system beyond the browser itself. This includes access to your user data
    and the ability to run arbitrary programs. Please be very cautious when adding third-party
    scripts and make sure you trust the code.

### How to uninstall this project?

To completely uninstall the project, you can follow the steps below. This will remove
all installed web apps, including their data, and other settings. You will not be able
to reverse this process, so make sure to back up any important data.

1. Uninstall all installed web apps using the extension or [the command-line program](../user-guide/console.md#uninstalling-a-web-app).
2. Remove all web app profiles using the extension or [the command-line program](../user-guide/console.md#removing-a-profile).
3. Uninstall the PWAsForFirefox extension from the browser.
4. Uninstall the PWAsForFirefox native program from the system.
5. Remove [the user data directory](../resources/installation-directories.md#user-data).

To uninstall the native program, you should follow the instructions of the package manager
you used to install it.

??? "Windows"

    You can uninstall the native program using the Windows Settings or Control Panel.

??? "Linux"

    You can uninstall the native program using the package manager you used to install it.
    You can remove the custom repository and the key by deleting their files from the system.

??? "macOS"

    You can uninstall the native program using Homebrew by running `brew uninstall firefoxpwa`.

## Usage

### How to install addons to the app browser?

You can open the built-in addon manager using a standard keyboard shortcut or the
app menu. You can also navigate to the addon store by opening the URL input (by
pressing ++f6++, ++ctrl+l++ or ++alt+d++) and entering `addons.mozilla.org`.

### How to access `about:config` in the app browser?

You can access `about:config` (or any other URL) by opening the URL input (by
pressing ++f6++, ++ctrl+l++ or ++alt+d++) and entering `about:config`.

### How to add a web app shortcut to the desktop?

It is possible to create a shortcut to the web app and add it to your desktop or other directory.

??? "Windows"

    1. Open the start menu directory: `%AppData%\Microsoft\Windows\Start Menu\Programs`
    2. Copy the shortcut for your web app to your desktop or other directory.

??? "Linux"

    1. Open the desktop entries directory: `~/.local/share/applications`
    2. Copy the shortcut for your web app to your desktop or other directory.

??? "macOS"

    1. Open the applications directory: `~/Applications`
    2. Hold ++option+cmd++ and drag the web app to your desktop or other directory.


!!! warning

    These steps may not work on all desktop environments.

### How to back up installed web apps or transfer them?

To back up installed web apps or transfer them to another computer, you can copy the
`config.json` file and the `profiles` directory inside [the user data directory](../resources/installation-directories.md#user-data).

After restoring the data, you need to run [the "Update web apps" option](../user-guide/extension.md#update-web-apps)
from the extension settings to register your web apps to the operating system.

## Troubleshooting

### Why can't I install a specific website I want?

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

Otherwise, you can check [the troubleshooting tasks](troubleshooting.md) and create
a new issue if needed.

### Why can't I create a profile when using template?

When creating a profile (or installing a web app into a new profile) with template, you
may receive error about non-existing files or directories or insufficient permissions.
This might happen because you copied the directory to a template while that profile was
running, which caused lock files to be copied along. It is recommended to close the
profile before you copy it as a template to prevent such problems.

In case creating a profile failed because of supposedly non-existing files or directories,
you may be able to fix this issue by removing a file named "lock" inside the template.

In case creating a profile failed because of insufficient permissions, make sure to apply
the correct permission to all files and directories inside the template directory.

### Why does the app browser look like a normal Firefox?

If the app browser looks like a normal Firefox, with tabs and the address bar displayed,
this might be caused by your settings. Check if [show browser tabs and enable using
multi-tabbed web apps](../user-guide/browser.md#show-browser-tabs-and-enable-using-multi-tabbed-web-apps)
is enabled or [display the address bar](../user-guide/browser.md#changing-the-address-bar)
is set to always in the app browser settings. Disabling those options might fix your issue.

If the relevant settings are disabled but the app browser still appears like a normal
Firefox, this has been caused by missing patches. You can run [patch profiles and
runtime](../user-guide/extension.md#patch-profiles-and-runtime) from the extension
settings to re-apply them.

### Why is the extension popup truncated on Linux?

Due to [a known issue](https://github.com/filips123/PWAsForFirefox/issues/230), when using
fractional display scaling on Linux, the extension popup might be truncated. In this case,
you might not be able to fully see all UI elements, notably the web app installation button.

A possible workaround is to use the ++tab++ key to select the button and press ++enter++
to execute it, or to temporarily disable fractional scaling when installing web apps.

### Why doesn't the extension find the native connector on Linux?

<!-- Headings here need to use HTML, so they don't appear in the table of contents -->

<h4>If you are using Firefox Snap (default on Ubuntu)</h4>

Recent Firefox Snap versions on Ubuntu support native messaging. First, make sure that
you are using recent enough Firefox and Ubuntu version.

When the extension first tries to access the native connector, a permission popup which
you need to accept should appear. If the popup didn't appear, or you denied the permission,
you need to manually allow it via the command line:

```shell
flatpak permission-set webextensions firefoxpwa snap.firefox yes
```

For this command to work, you will need [Flatpak](https://flatpak.org/setup/) installed.
After you ran the command and confirmed that the extension detected the native connector,
you can remove Flatpak.

<h4>If you are using Firefox Flatpak</h4>

Flatpak does not support native messaging yet, but they are working on adding support for
it. You can follow [the `xdg-desktop-portal` issue](https://github.com/flatpak/xdg-desktop-portal/issues/655)
for progress.

If you want to use PWAsForFirefox, you will need to use Firefox from your distribution's
repository or Mozilla's website instead. Other workarounds may exist, but they are
not officially supported.

<h4>If you are using Firefox from PPA or distribution's repository</h4>

Firefox distributed with some distributions can have bugs that break native messaging.
Such bugs should be reported to the maintainers of that repository. You can instead use
Firefox downloaded directly from Mozilla's website.

!!! tip

    If you have other similar problems, it's a good test to check if other addons that
    use native messaging (KeePassXC, Plasma Integration, etc.) work with your setup.
    If they also do not work, it's probably a problem with your Firefox version/setup.
    If they do work, it might be a problem with PWAsForFirefox.

### How to fix a security features warning on Linux?

You may see a warning that "some of Firefox’s security features may offer less protection
on your current operating system" on specific Linux distributions.

The sandbox in Firefox makes use of unprivileged user namespaces when creating new processes
for enforcing more security. This can be considered a security risk, therefore some Linux
distributions have started to restrict its usage and only allow it to work where there is
an AppArmor profile. You can read more about this warning in [the official Mozilla
documentation](https://support.mozilla.org/kb/linux-security-warning).

The default AppArmor profile currently cannot cover the runtime used by PWAsForFirefox,
so you will have to manually create a custom AppArmor profile for the runtime.

To configure a custom AppArmor profile for the runtime, create a file named `firefoxpwa`
in `/etc/apparmor.d/` with the following content:

```apparmor
# This profile allows everything and only exists to give the
# application a name instead of having the label "unconfined"

abi <abi/4.0>,
include <tunables/global>

profile firefoxpwa /home/<USER>/.local/share/firefoxpwa/runtime/{firefox,firefox-bin,updater} flags=(unconfined) {
  userns,

  # Site-specific additions and overrides. See local/README for details.
  include if exists <local/firefox>
}
```

You should replace `<USER>` with your username. You may also need to replace the path
to the runtime depending on your [user data directory](../resources/installation-directories.md#runtime).

After creating the profile, you need to reload the AppArmor profiles:

```shell
sudo systemctl restart apparmor.service
```

### Why does the extension detect a wrong connector version on Windows?

Because of [a known problem](https://github.com/filips123/PWAsForFirefox/issues/268),
the installer might not detect an existing PWAsForFirefox installation and instead
install a new version along the existing one.

This problem most often happens if you have initially installed PWAsForFirefox to a
per-user location, but kept the default installation options when installing updates,
which installed a newer version separately to a global directory.

This might cause the extension to detect and use a wrong/old native connector, which
might not contain all the latest features and fixes.

To fix this problem:

1. Uninstall any existing PWAsForFirefox versions from the Windows Settings.

2. Remove directories `C:\Program Files\FirefoxPWA` and `%LOCALAPPDATA%\Programs\FirefoxPWA`, if they exist. If you have previously chosen a different installation directory, make sure to also remove it.

3. Remove registry keys `HKLM\Software\filips\FirefoxPWA` and `HKCU\Software\filips\FirefoxPWA`, if they exist.

4. Remove registry keys `HKLM\Software\Mozilla\NativeMessagingHosts\firefoxpwa` and `HKCU\Software\Mozilla\NativeMessagingHosts\firefoxpwa`, if they exist.

5. Reinstall PWAsForFirefox. To make it less likely that this problem occurs again, it is recommended to install PWAsForFirefox for all users and keep the default installation directory (`C:\Program Files\FirefoxPWA`). If you instead choose a different installation option, make sure to remember it and always select the same option and directory when installing updates.

6. Run [the "Patch profiles and runtime" option](../user-guide/extension.md#patch-profiles-and-runtime) from the extension settings.

### Why does installing a web app fail on macOS?

Compiling the loader while installing a web app on macOS requires the Xcode Command
Line Tools to be installed.

They should be automatically installed when using Homebrew. If they are not installed,
you can install them by running the following command:

```shell
xcode-select --install
```

If the Xcode Command Line Tools are installed, but the web app installation still fails,
you can try to remove them by running the following command and install them again:

```shell
sudo rm -rf /Library/Developer/CommandLineTools
```

### Why doesn't allowing microphone or camera work on macOS?

Due to [an unknown problem](https://github.com/filips123/PWAsForFirefox/issues/404),
trying to allow microphone or camera permissions may crash the web app on macOS.

As a workaround, it is possible to manually grant the required permissions to the
app browser using the steps below. This needs to be done once for every profile
where the microphone or camera access is required.

1. Create a web app into a new profile via the normal process.

2. Use ++cmd+i++ to manually open the permissions window and select the "Permissions" tab.

3. Set "Microphone" and "Camera" to "Always Allow".

4. Click the 9-box grid in the upper right of the Google banner and then select Google Search. Search for "webcamtests" and then open the `webcamtests.com` website from the results.

5. Run the webcam test and the microphone test one after another.

6. A permission dialogs from macOS should appear for each test ("Do you want to allow NAME to access the Microphone?", "Do you want to allow NAME to access the Camera?".

7. Answer yes to both dialogs.

8. The microphone and camera should now work.
