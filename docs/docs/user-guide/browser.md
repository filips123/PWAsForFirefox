# App Browser Guide

This page describes features of the app browser (the custom Firefox installation that runs
installed web apps). Most existing Firefox features are available, although with some
differences, but the project also adds some new features to make experience better.

## Using the App Browser

### Using Web Apps

When you launch a web app (for example, from the system start/app menu), it will
automatically open in the app browser. You don't have to do anything special.

By default, when you navigate to the website that is outside the scope of the current web
app, the browser will display a disabled address bar with the current URL. This is used
for security reasons to ensure that you know you are not in the original web app anymore.
This behaviour can be changed in the settings (see below for configuration options).

### Using Firefox Features

Most built-in standard Firefox features can still be accessed, including support for
addons. The main differences are that the main Firefox menu button and default widgets
have been moved to the titlebar, and that tabs and address bar are hidden by default.

Features that require entering URL directly (such as `about:config`) can be used by
navigating to the URL (see below for the URL input instructions).

Addons can be installed from the built-in Firefox addon manager (which can be accessed
with a keyboard shortcut or from the Firefox menu) or by manually navigating to the Addon
Store URL (see below for the URL input instructions).

### Navigating to Arbitrary URLs

You can open a basic URL input popup by pressing ++f6++, ++ctrl+l++ or ++alt+d++. You can
navigate to any URL, including built-in ones such as `about:config`. Please keep in mind
that auto-completion and search functionality are not supported.

## Additional Toolbar Widgets

The app browser provides some additional toolbar widgets that can be used for additional
functionalities or provide an alternative to existing, now hidden widgets. Some of them
are enabled by default, others can be enabled in the Firefox customize page.

### Site Information

Enabled by default, cannot be disabled. Provides site information that would otherwise be
displayed in the address bar.

### Site Permissions

Enabled by default, cannot be disabled. Provides a list of permissions granted to the
current site that would otherwise be displayed in the address bar.

### Site Notification

Enabled by default, cannot be disabled. Provides access to popups by sites requesting
additional permissions.

### Tracking Protection

Enabled by default. Provides access to tracking protection popup that would otherwise be
accessible from the address bar.

### Toggle Sound

Enabled by default. Provides support to toggle the page sound that would otherwise be
possible from the tab icon.

### Reader View

Enables or disables the reader view/mode for the current page.

### Copy Link

Copies the current URL to the clipboard.

### Share Link

Shares the current URL using the system sharing functionality.

### Send to Device

Sends the current URL to another device using Firefox Account.

### Open in Browser

Opens the current URL in a default system browser.

## Additional Keyboard Shortcuts

### ++ctrl+shift+n++

Opens a new window in a default system browser.

### ++ctrl+alt++

Toggles the icon bar (if hiding is enabled in the settings).

## Additional Context Menu Items

### Open Link in Default Browser

Opens the link in a default system browser. Displayed only when clicking on links.

## Configuration Options

!!! tip

    These settings can be accessed in the same place as standard Firefox settings in the app
    browser: In the web app window, click on the hamburger menu near the top right corner
    and open settings. Alternatively, they can also be accessed from `about:config`.

!!! tip

    You may need to restart the app browser for some configuration options to take effect.

<!-- Section: Colors -->

### Allow web apps to override a theme (titlebar) color

Determines whether the web apps can override a theme (titlebar) color of the window.

On most systems, it will correctly set the theme color to the color specified in the
manifest. However, it may cause problems on some Linux DEs, so you may need to disable it.

* Preference name: `firefoxpwa.sitesSetThemeColor`
* Default value: `true`

### Allow web apps to override a background (window) color

Determines whether the web apps can override a background color of the window.

On most websites, it will correctly set the background color to the color specified in the
manifest. However, it may cause problems on some websites, so you may need to disable it.

* Preference name: `firefoxpwa.sitesSetBackgroundColor`
* Default value: `true`

### Allow web apps to dynamically change a theme color

Determines whether the web apps can dynamically change a theme color using `meta` tags.

* Preference name: `firefoxpwa.dynamicThemeColor`
* Default value: `true`

<!-- Section: Titlebar -->

### Change the window title based on the web app's title

Determines whether the window title is dynamically changed to the web app's title.

* Preference name: `firefoxpwa.dynamicWindowTitle`
* Default value: `true`

### Change the window icon based on the web app's icon

Determines whether the window icon is dynamically changed to the web app's icon.

* Preference name: `firefoxpwa.dynamicWindowIcon`
* Default value: `true`

### Always use native window controls (Linux-only)

Determines whether native window controls should be displayed even when using Firefox
themes. Only displayed and used on Linux with CSD enabled.

* Preference name: `firefoxpwa.alwaysUseNativeWindowControls`
* Default value: `false`

<!-- Section: User Experience -->

### Open out-of-scope URLs in a default browser

Determines whether out-of-scope URLs should be opened in a default browser.

Enabling this option will automatically close the web app window and open any out-of-scope
URLs in a default system browser. This may cause problems on some websites, especially
ones that use SSO (such as Google, YouTube, Spotify, Outlook.com). In such cases, it is
recommended to use it in combination with [domains always allowed to be opened in the
app browser](#domains-always-allowed-to-be-opened-in-the-app-browser).

* Preference name: `firefoxpwa.openOutOfScopeInDefaultBrowser`
* Default value: `false`

### Domains always allowed to be opened in the app browser

Determines which domains should always be opened in the app browser.

This option can be used to always load a specific domain in the app browser, even if the
URL is out-of-scope. This can be useful for websites that do not work properly with [the
previous option](#open-out-of-scope-urls-in-a-default-browser) enabled. It only has an
effect when that option is also enabled.

The value should be a comma-separated list of *domains* (without protocol and path). A
wildcard `*` can to match zero or more characters. A wildcard can be escaped by using `\*`.

* Preference name: `firefoxpwa.allowedDomains`
* Default value: `""`

!!! tip

    You can check [a list of recommended values](../resources/specific-website-tips.md#websites-with-multiple-domains)
    for some popular websites.

### Show browser tabs and enable using multi-tabbed web apps

Determines whether the tabs mode is enabled.

Enabling this option will cause the app browser to display tabs, similar to a normal
browser, but without the address bar. It will also re-enable new tab keyboard shortcuts
and menu items, and replace the new tab page with a web app start URL. This will allow you
to use multiple tabs of the same web app in the same window.

* Preference name: `firefoxpwa.enableTabsMode`
* Default value: `false`

<!-- Section: Links Target -->

### Changing the links target

> When opening a link that should normally open in a new window or tab:
>
> * 0 - Do not change link behaviour (not recommended)
> * 1 - Force links into the current tab (default)
> * 2 - Force links into a new window
> * 3 - Force links into a new tab

Determines whether `_blank` links target is forced into the current tab or a new window.

* Preference name: `firefoxpwa.linksTarget`
* Default value: `1`

<!-- Section: Launch Type -->

### Changing the launch type

> When launching a web app that is already opened:
>
> * 0 - Open web app in a new window (default)
> * 1 - Open web app in a new tab
> * 2 - Replace the existing tab
> * 3 - Focus the existing window

Determines what happens when a web app is launched if the same web app is already opened.

* Preference name: `firefoxpwa.launchType`
* Default value: `0`

<!-- Section: Address Bar -->

### Changing the address bar

> Display the address bar:
>
> * 0 - Display the address bar when out-of-scope (default)
> * 1 - Never display the address bar
> * 2 - Always display the address bar

Determines whether the address bar is displayed only when out-of-scope, always, or never.

* Preference name: `firefoxpwa.displayUrlBar`
* Default value: `0`

<!-- Section: Icon Bar -->

### Allowing hiding the icon bar

!!! warning

    This is a hidden, `about:config`-only option. It is only meant for advanced users
    with a tiling window manager, and can cause problems otherwise. When the icon bar
    is hidden, you will not be able to access Firefox icons and menus.

!!! warning

    When the icon bar is hidden, popups for installing extensions, granting site
    permissions and others will not work. Before doing actions that open popups,
    you need to temporarily enable the icon bar.

Determines whether hiding the icon bar is allowed and displays an option in the customize page.

This does *not* hide the icon bar on its own. It only adds an entry to the "toolbars" menu
in the Firefox customize page that allows you to hide the icon bar. To temporarily display
the icon bar, use the ++ctrl+alt++ keyboard shortcut. To permanently enable it, go to the
customize page, *uncheck the icon bar entry* in the menu and *check it again*.

* Preference name: `firefoxpwa.enableHidingIconBar`
* Default value: `false`

<!-- Section: Keyboard Shortcuts -->

### Disabling keyboard shortcuts

Determines whether specific shortcuts are enabled or not.

* Close tab (++ctrl+w++)
* Close window (++ctrl+shift+w++)
* Quit application (++ctrl+shift+q++)
* Private browsing (++ctrl+shift+p++)

All shortcuts are enabled by default.
