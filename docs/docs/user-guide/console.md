# Console Guide

The project provides a `firefoxpwa` console program that can be used to install, launch
and manage web apps instead of the extension.

The executable should be automatically added to `PATH` on installation. To display the
built-in help, run `firefoxpwa --help` or `firefoxpwa <command> --help`.

The project also provides shell completion files for Bash, Elvish, Fish, PowerShell, and Zsh.

!!! note

    On Windows, all completions are installed into the `completions` directory in your
    chosen installation directory, but you need to manually load them into your shell.
    When using DEB or RPM packages or installing the package from Homebrew or AUR,
    completions for Bash, Fish, and Zsh are automatically installed into required
    directories and loaded by shells.

    For other operating systems or shells, you can find the pre-built completions in
    build artifacts and release attachments, or build them along with the project
    (they will be in `target/{PROFILE}/completions`).

## Runtime Management

To be able to launch web apps, you need to download and install the Firefox runtime:

```shell
firefoxpwa runtime install
```

The runtime is completely separated from your main Firefox installation and does not
interfere with it or other Firefox installations.

!!! note

    To install runtime on Windows, you need to have [7-Zip](https://7-zip.org/)
    installed. Installing the runtime will automatically trigger the 7-Zip installer
    if needed, which may require accepting User Account Control prompt. You can also
    manually install 7-Zip or use your existing 7-zip installation. After the runtime
    is installed, you can delete 7-Zip manually.

You can uninstall the runtime, but you won't be able to launch web apps until you install it back:

```shell
firefoxpwa runtime uninstall
```

!!! tip

    Instead of using the default runtime (normal Firefox), you can manually download an
    alternative Firefox version or Firefox fork (LibreWolf, IceCat, Waterfox, etc.). However,
    please keep in mind that compatibility with other or unofficial runtimes not guaranteed.

    You can check [FAQ](../help/faq.md#how-to-use-an-alternative-browser-as-an-app-browser) for instructions.

## Profile Management

Web apps use a separate profile system from the normal Firefox, so data such as installed
extensions, passwords, logins, etc. are not shared with your normal browser profile. This
is used to make web apps more reliable and allow additional customization. If you want to
sync data between your main and web app profile, it is recommended to use Firefox Account
or a third-party sync solution.

By default, web apps are installed to a common profile with ID `00000000000000000000000000`.

You can also create separate isolated profiles and install web apps there, which allows
you to install multiple instances of the same web app with different accounts.

### Creating a Profile

```shell
firefoxpwa profile create --name PROFILE-NAME --description PROFILE-DESCRIPTION --template PROFILE-TEMPLATE
```

This will create a new profile directory and return its ID. You will need that ID later
to install the web apps into the profile or remove it.

The name and description arguments are optional. If omitted, they are set to empty values.

The template argument is also optional. If specified, all contents of the provided
template directory will be copied to a newly-created profile. This is useful if you want
to create a new profile with the same extensions, settings, etc. as an existing one.

!!! tip

    If you want to use an existing profile as a template, make sure it is not running
    before copying as a template. Otherwise, it will contain lock files that can cause
    errors when creating or running a profile from template. You can check [FAQ](../help/faq.md#why-cant-i-create-a-profile-when-using-template)
    for more details.

You can check [a list of most available profile properties and settings](../resources/profile-properties.md).

### Removing a Profile

```shell
firefoxpwa profile remove ID
```

This will completely remove the profile and all web apps installed in it, **including all
user data**. You might not be able to fully recover this action.

The default profile cannot be completely removed. Trying to remove it will just clear all
web apps and user data, but keep a profile ID in the profile list.

### Editing a Profile

```shell
firefoxpwa profile update ID --name NEW-PROFILE-NAME --description NEW-PROFILE-DESCRIPTION
```

This will change profile's name and description, while keeping installed web apps intact.

Both arguments are optional. Omitted arguments will not change profile's properties.
Setting arguments to an empty value will clear their properties.

### Listing Profiles

```shell
firefoxpwa profile list
```

This will print all your profiles and web apps installed in them, including their IDs.
You will need profile IDs to install a new web app into a separate profile or remove a
profile, and web app IDs to launch or remove them.

## Web App Management

### Installing a Web App

```shell
firefoxpwa site install MANIFEST-URL --profile PROFILE-ID [...]
```

This will download the web app manifest, parse it and register the web app to the OS. It
will also return the web app ID that you will need to launch it.

The profile is optional and will default to the shared profile. Other arguments are
available; you can check them in the program help. You can also check [a list of most
available web app properties and settings](../resources/web-app-properties.md).

!!! warning

    You cannot re-use the same name for multiple web apps, because newer ones can overwrite
    menu entries for existing web apps. You should also be careful not to re-use the name
    of an existing native app, because it can also overwrite its menu entry.

    You cannot install multiple instances of the same web app in the same profile,
    because they would actually be the same instance. Instead, install each instance
    into a separate profile.

### Uninstalling a Web App

```shell
firefoxpwa site uninstall ID
```

This will uninstall the web app and remove it from the list. However, web app data will
stay and will be reused if you later install it again in the same profile. To clear the
data, do that through the app browser, or also remove a profile.

### Updating a Web App

```shell
firefoxpwa site update ID --name SITE-NAME --description SITE-DESCRIPTION [...]
```

This will change web app's information, such as name, description, icon, etc. It will
also (unless disabled) update the web app manifest and icons, and re-apply the system
integration.

You can check all available arguments in the program help. Omitted arguments will not
change web app's properties. Setting arguments to an empty value will clear their properties.

### Launching a Web App

```shell
firefoxpwa site launch ID
```

This will launch the Firefox browser runtime and open the web app.

To launch a web app with a custom start URL, use the `--url` argument. When the tabs mode
is enabled, you may specify this argument multiple times to launch URLs as multiple tabs.
To launch a web app with a protocol handler (on supported web apps), use the `--protocol`
argument.
