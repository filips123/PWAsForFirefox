# Extension Guide

The browser extension makes it easy to install and manage Progressive Web Apps directly
from your main Firefox installation. It supports installing PWAs with just a few clicks,
managing and launching them, and creating and managing profiles directly from the browser.

## Quickstart

### Setup

When the extension is installed, it will automatically open a new tab with instructions
for setting up the project. This includes accepting the license agreement, installing the
native program, and installing runtime. The instructions are provided in a form of an
easy-to-follow wizard. Once the process is completed, you can start using the extension.

### Installing a Web App

When a website is a valid PWA (loaded over HTTPS and has a linked web app manifest), the
option to install it will automatically appear in the address bar (unless disabled in the
extension settings). Clicking on it will bring up a popup menu, from which you can install
the web app.

If the website is not a valid PWA, the installation action will not appear (unless enabled
in the extension settings). However, you can still install such websites using the extension's
browser action. This method does not require a web app manifest and can be used for any website.

!!! tip

    If the installation fails because of a manifest-related error, you can try disabling
    the use of manifest for determining the app properties and installing it again.

    Some websites cannot be installed because they use invalid manifests. We maintain
    [a list of those websites](../resources/specific-website-tips.md#websites-with-invalid-manifests).

!!! warning

    You cannot re-use the same name for multiple web apps, because newer ones can overwrite
    menu entries for existing web apps. You should also be careful not to re-use the name
    of an existing native app, because it can also overwrite its menu entry.

    You cannot install multiple instances of the same web app in the same profile,
    because they would actually be the same instance. Instead, install each instance
    into a separate profile.

### Launching a Web App

When you open a website that has already been installed, the launch action will appear
in your address bar. When you click on it, the popup will appear where you can launch
existing instances of the web app or create a new one.

You can also launch the web app through system start/app menus, or from the web app list
in the extension's browser action.

## Profile Management

Web apps use a separate profile system from the normal Firefox, so data such as installed
extensions, passwords, logins, etc. are not shared with your normal browser profile. This
is used to make web apps more reliable and allow additional customization. If you want to
sync data between your main and web app profile, it is recommended to use Firefox Account
or a third-party sync solution.

By default, web apps are installed to a common "default" profile. You can also create
separate isolated profiles and install web apps there, which allows you to install
multiple instances of the same web app with different accounts. When installing a new
web app, you also have an option to automatically create a new profile just for it.

All profiles can be accessed and managed through the "profiles" tab in the extension. You
can check [a list of most available profile properties and settings](../resources/profile-properties.md).

If the template option is specified, all contents of the provided template directory will
be copied to a newly-created profile. This is useful if you want to create a new profile
with the same extensions, settings, etc. as an existing one. If the template option
is not specified, the new profile will use [the default template](#default-profile-template)
that can be set in the extension settings.

!!! tip

    If you want to use an existing profile as a template, make sure it is not running
    before copying as a template. Otherwise, it will contain lock files that can cause
    errors when creating or running a profile from template. You can check [FAQ](../help/faq.md#why-cant-i-create-a-profile-when-using-template)
    for more details.

## Web App Management

Installed web apps can be viewed and managed in the "web apps" tab in the extension.
It allows you to launch, edit and uninstall web apps.

When editing a web app, you can change its properties, such as name, description and
icon. Unless disabled, editing a web app also updates its manifest and icon, as well
as re-apply the system integration. You can also check [a list of most available web
app properties and settings](../resources/web-app-properties.md).

Editing a web app allows you to change which of the supported protocol handlers you want
to be enabled. By default, all protocol handlers specified in the web app manifest are
disabled. Some websites also dynamically register protocol handlers; those are enabled
automatically if you accept the Firefox prompt.

You can also customize when the web app [will launch automatically](../resources/web-app-properties.md#auto-launch-settings).

## Extension Settings

### Display address bar widget

When "On valid progressive web apps" is set (default), the address bar widget will only
be displayed when the current website is a valid PWA (loaded over HTTPS and has a linked
web app manifest). The other two options are self-explanatory.

### Launch web apps on active URLs

If enabled (default), when launching from the address bar widget, the web app will
be launched on the current URL. If disabled, the web app will be launched on the
default start URL.

### Show a popup on extension updates

If enabled (default), a notification will be displayed when the extension is updated.

### Enable automatic web app launching

If enabled, all URLs that match the scopes of your enabled web apps will be automatically
launched as a web app.

!!! warning

    This feature is experimental, may not work with all websites correctly,
    and may impact performance.

This option needs to be additionally enabled per web app in its settings, using [the "Launch
this web app on matching website" checkbox](../resources/web-app-properties.md#launch-this-web-app-on-matching-website).
Specific URLs can also be excluded from being automatically launched inside web apps with
[the exclusion regex option](#automatic-launching-exclusion).

Additional browser permissions are required for this option to work. They will be requested
automatically after enabling the option if they are not already permitted.

### Always patch runtime and profile

If enabled, the runtime and profile will be patched every time the web app is launched.
If disabled (default), they will only be patched when a new version is released.

This option does not apply to macOS, because patching is always required on that platform.

### Use Wayland Display Server (Linux-only)

If enabled, the Firefox runtime will be instructed to use the Wayland display server.
This is equivalent to setting the `MOZ_ENABLE_WAYLAND` environment variable to `1`.

### Use X Input Extension 2 (Linux-only)

If enabled, the Firefox runtime will be instructed to use the X Input Extension 2.
This is equivalent to setting the `MOZ_USE_XINPUT2` environment variable to `1`.

### Use XDG Desktop Portals (Linux-only)

If enabled, the Firefox runtime will be instructed to use XDG Desktop Portals.
This is equivalent to setting the `GTK_USE_PORTAL` environment variable to `1`.

### Default profile template

If specified, the provided directory will be used as a profile template when creating
all new profiles, unless a different template directory is explicitly set when creating
a profile.

All contents of the provided template directory will be copied to a newly-created profile.

### Automatic launching exclusion

If specified, any URLs that match the provided regex will be excluded from the automatic
web app launching (will not automatically open inside a web app). This might be useful
when a website has own "redirection" URLs that you do not want to open in a web app.
This option only has an effect when [automatic web app launching](#enable-automatic-web-app-launching)
is enabled.

### Language

The extension is translated into multiple languages. You can select which one you want to use.

!!! warning

    Translations are maintained by the community and may be incomplete or incorrect.

    You can help to improve them on [Crowdin](https://crowdin.com/project/firefoxpwa).

### Update web apps

This will download and parse manifests for all your web apps and register them again to
the operating systems. Any changes in web app manifests will also be reflected on your
system.

Alternatively, you can register all web apps to the operating system without performing
any manifest updates. This can be used if you transferred your config file from another
device.

### Patch profiles and runtime

This will patch all profiles and runtime with the current globally installed version.

This is useful after (re)installing a custom runtime, or if you are experiencing
problems with web app launching.

### Reinstall runtime

This will remove your current runtime and download the latest version from Mozilla.
It will also replace any custom runtime that you manually downloaded.

This will not affect your main Firefox browser and will not remove any profiles or data.

!!! warning

    This option may not work on all platforms that PWAsForFirefox supports, as Firefox
    does not provide pre-built packages for some platforms, and automatic installation
    for some platforms is too hard to implement. For those platforms, you need to
    manually (re)install the runtime.
