# Supported Features

<!-- Once MkDocs Material card grids are publicly available (Goat's Horn) -->
<!-- We can try to use them to make this page look better and more "attractive" -->
<!-- Also add links to specific documentation pages, screenshots, descriptions, etc. -->

<!-- This part is currently shared between the main README, homepage and features page -->
<!-- We should try to do something about this in the future -->

<!-- Check if this is really "supported features", as "not planned features" are alo listed here -->
<!-- But naming it just "features" makes it stand out in the sidebar too much... -->

## Available Features

* Command-line tool to install, manage and run Progressive Web Apps in Firefox.
* Extension to set up native programs, and install, manage and run PWAs and their profiles directly from the main Firefox browser.
* Isolated Firefox installation and profile(s) that stores the PWAs.
* Installed PWAs have their own start/app menu entry and taskbar icon, and live in their own window.
* Installed PWAs have tabs and address bar for a better app-like feel.
* Support for installing all websites as Progressive Web Apps.
* Support for all Firefox addons/extensions and built-in Firefox features.
* Support for automatic (user-triggered) installation and patching of installation and profile(s).

## Planned Features

* Localization of most UI elements.
* Support for more system-related web app manifest features (once they are standardized).

## Not Planned Features

* **Integration into official Firefox code.** This project currently modifies the browser chrome (UI) at runtime using JS and CSS. Although this works, it is officially unsupported by Mozilla and can break with Firefox updates. To contribute features back into the official Firefox code, they would need to be implemented properly with the new chrome page and browser services. Unfortunately, this requires an almost complete rewrite of the project, and I currently don't have enough knowledge and time to do that.

* **Using the same installation profile for PWAs and normal browsing.** This could make the main browser installation/profile unstable if things break. It would also prevent customizing the PWA profile to work better as a PWA profile, and installing custom addons. If you want to sync data between your main and PWA profile, I recommend using Firefox Account or a third-party sync solution.

* **Running PWAs installed as Windows APPX/MSIX packages or from Microsoft Store.** They will always use Chromium-based Edge that is installed on Windows 10/11. I'm not sure if it is possible to override this. If it is not too hard and doesn't cause any problems, I may try this in the future.

* **Support for Chromium-specific APIs (Filesystem, Bluetooth, NFC, USB...).** This would require forking and directly modifying the Firefox source. Also, I'm not sure if giving websites the same privileges as native apps is the best idea...
