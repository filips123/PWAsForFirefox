# Web App Properties

**TODO: Document recently-added web app properties/settings**

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

A URL that is opened when the web app is launched.

## Icon URL

A URL of the icon that is used as an application icon.

## Protocol Handlers

Determine which supported protocol handlers are enabled for that web app.
