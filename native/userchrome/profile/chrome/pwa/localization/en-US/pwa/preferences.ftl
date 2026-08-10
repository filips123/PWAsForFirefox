### Pane and group titles should be translated in the same style and capitalization as existing Firefox messages in your language
### Example: https://pontoon.mozilla.org/sl/firefox/browser/browser/preferences/preferences.ftl/?search=pane-account-sync-title&search_identifiers=true
### Example: https://pontoon.mozilla.org/sl/firefox/browser/browser/preferences/preferences.ftl/?search=preferences-contrast-control-group&search_identifiers=true

## Web Applications Pane

pane-web-apps-title = Web applications
    .title = { pane-web-apps-title }

pane-web-apps-section =
    .heading = { pane-web-apps-title }
    .description = You may need to restart the browser to apply these settings.

group-appearance-header =
    .label = Appearance
    .description = Customize how the web app integrates with your operating system visually.

group-appearance-titlebar-header =
    .label = Titlebar

group-appearance-colors-header =
    .label = Colors

group-interface-header =
    .label = Interface and layout
    .description = Customize the toolbars and controls in the web app window.

group-behavior-header =
    .label = Navigation and behavior
    .description = Customize how the web app behaves when navigating and opening.

group-behavior-out-of-scope-header =
    .label = Out-of-scope navigation

group-shortcuts-header =
    .label = Keyboard shortcuts
    .description = Customize which keyboard shortcuts are enabled.

## Titlebar Preferences

dynamic-window-title =
    .label = Change the window title based on the web app's title

dynamic-window-icon =
    .label = Change the window icon based on the web app's icon

native-window-controls =
    .label = Always use native window controls

## Colors Preferences

sites-set-theme-color =
    .label = Allow web apps to override the theme (titlebar) color

sites-set-background-color =
    .label = Allow web apps to override the background color

dynamic-theme-color =
    .label = Dynamically change the theme color

## Tabs Preference

enable-tabs-mode =
    .label = Enable the multi-tabbed interface

manage-tabs-behavior =
    .label = Manage more tab behavior settings

## Address Bar Preference

display-address-bar-label =
    .label = Address bar visibility

display-address-bar-choice-out-of-scope =
    .label = Visible when the URL is out-of-scope

display-address-bar-choice-always =
    .label = Always visible

display-address-bar-choice-never =
    .label = Never visible

## Launch Type Preference

launch-type-label =
    .label = App relaunching behavior
    .description = When launching a web app that is already running…

launch-type-choice-new-window =
    .label = Open app in a new window

launch-type-choice-new-tab =
    .label = Open app in a new tab

launch-type-choice-replace =
    .label = Replace the existing tab

launch-type-choice-focus =
    .label = Focus the existing window

## Links Target Preference

links-target-label =
    .label = Link opening behavior
    .description = When clicking a link that normally opens in a new tab or window…

links-target-choice-new-window =
    .label = Open link in a new window

links-target-choice-new-tab =
    .label = Open link in a new tab

links-target-choice-current-tab =
    .label = Replace the current tab

links-target-choice-keep =
    .label = Do not change link behavior

# Out-of-Scope Navigation Preferences

open-out-of-scope-in-default-browser =
    .label = Open out-of-scope URLs in the default browser
    .description = Warning: Can break authentication flows in some web apps

allowed-domains =
    .label = Domains always allowed to be opened in the app browser
    .description = Enter a comma-separated list of domains (e.g. example.com,*.example.com)…
    .placeholder = example.com,*.example.com

## Keyboard Shortcuts Preferences

shortcuts-close-tab =
    .label = Close tab ({ $shortcut })

shortcuts-close-window =
    .label = Close window ({ $shortcut })

shortcuts-quit-application =
    .label = Quit application ({ $shortcut })

shortcuts-private-browsing =
    .label = Private browsing ({ $shortcut })
