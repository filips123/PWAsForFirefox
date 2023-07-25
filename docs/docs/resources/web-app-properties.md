# Web App Properties

## Name

A web app name. Used as an application name in the system menus.

!!! warning

    You cannot re-use the same name for multiple web apps, because newer ones can overwrite
    menu entries for existing web apps. You should also be careful not to re-use the name
    of an existing native app, because it can also overwrite its menu entry.

    You cannot install multiple instances of the same web app in the same profile,
    because they would actually be the same instance. Instead, install each instance
    into a separate profile.

## Description

A web app description. Used as an application description in the system menus.

## (Menu) Categories

On Linux, macOS and PortableApps.com, web app categories are mapped to appropriate
categories for that platform. For example, on Linux, the categories determine in which
menu categories the app appears (on DEs that support menu categories). On Windows,
categories are not supported and are ignored, but they can still be used for user
organization. On macOS and PortableApps.com, the application can have only one category,
so only the first one is used.

## (Menu) Keywords

Keywords are used as additional search queries on Linux. On other platforms, keywords
are not supported and are ignored, but they can still be used for user organization.

## Start URL

A URL that is opened when the web app is launched. If not specified, the default start
URL is used.

## Icon URL

A URL of the icon that is used as an application icon. If not specified, the default
icons are used.

## Protocol Handlers

Determine which supported protocol handlers are enabled for that web app.

By default, all protocol handlers specified in the web app manifest are disabled. Some
websites also dynamically register protocol handlers; those are enabled automatically if
you accept the Firefox prompt.

## Auto Launch Settings

### Launch this web app on matching website

If enabled, all URLs that match the scopes of your web app will be automatically
launched as a web app. Specific URLs can also be excluded from being automatically
launched inside web apps with [the exclusion regex option](../user-guide/extension.md#automatic-launching-exclusion)
in the main extension settings.

This option is only available when [automatic web app launching](../user-guide/extension.md#enable-automatic-web-app-launching)
is enabled in the main extension settings.

### Launch this web app on system login

If enabled, the web app will be automatically launched when you log into the system.

This option is not available on macOS, as launching on login can easily be enabled directly
from the macOS UI instead.

### Launch this web app on browser launch

If enabled, the web app will be automatically launched when you launch your main browser
(the browser where the extension is installed).
