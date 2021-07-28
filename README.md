![Logo](https://gist.githubusercontent.com/filips123/6f2a9eaf9261754110b361aabe6dff62/raw/c8e01c88fe6b7112579d4564907a1d75f07d5c5d/firefoxpwa.svg)

Progressive Web Apps for Firefox
================================

A tool to install, manage and use Progressive Web Apps (PWAs) in Mozilla Firefox.

## Description

[Progressive Web Apps (PWAs)](https://developer.mozilla.org/docs/Web/Progressive_web_apps) are web apps that use web APIs and features along with progressive enhancement strategy to bring a native app-like user experience to cross-platform web applications. Although Firefox supports many of Progressive Web App APIs, it does not support functionality to install them as a standalone system app with an app-like experience.

This project modifies Firefox to allow websites to be installed as standalone apps and provides a console tool and browser extension to install, manage and use them.

## Usage

**TLDR**: Install [the browser extension](https://addons.mozilla.org/firefox/addon/firefoxpwa/) and follow in-browser installation instructions. Check [the repository wiki](https://github.com/filips123/FirefoxPWA/wiki) for simple usage instructions.

For detailed and more technical documentation how to set up, use and develop the project, see the READMEs of the native and extension part:

* [Native](native/README.md)
* [Extension](extension/README.md)

## Features

### Current Features

* Command-line tool to install, manage and run Progressive Web Apps in Firefox.
* Extension to set up native programs, and install, manage and run PWAs and their profiles directly from the main Firefox browser.
* Isolated Firefox installation and profile(s) that stores the PWAs.
* Installed PWAs have their own start/app menu entry and taskbar icon, and live in their own window.
* Installed PWAs have tabs and address bar for a better app-like feel.
* Support for installing all websites as Progressive Web Apps.
* Support for all Firefox addons/extensions and built-in Firefox features.
* Support for automatic (user-triggered) installation and patching of installation and profile(s).

### Planned Features

* Localization of most UI elements.
* Support for more system-related web app manifest features (once they are standardized).

### Not Planned Features

* **Integration into official Firefox code.** This project currently modifies the browser chrome (UI) at runtime using JS and CSS. Although this works, it is officially unsupported by Mozilla and can break with Firefox updates. To contribute features back into the official Firefox code, they would need to be implemented properly with the new chrome page and browser services. Unfortunately, this requires an almost complete rewrite of the project, and I currently don't have enough knowledge and time to do that.

* **Using the same installation profile for PWAs and normal browsing.** This could make the main browser installation/profile unstable if things break. It would also prevent customizing the PWA profile to work better as a PWA profile, and installing custom addons. If you want to sync data between your main and PWA profile, I recommend using Firefox Account or a third-party sync solution.

* **Running PWAs installed as Windows APPX/MSIX packages or from Microsoft Store.** They will always use Chromium-based Edge that is installed on Windows 10. I'm not sure if it is possible to override this. If it is not too hard and doesn't cause any problems, I may try this in the future.

* **Support for Chromium-specific APIs (Filesystem, Bluetooth, NFC, USB...).** This would require forking and directly modifying the Firefox source. Also, I'm not sure if giving websites the same privileges as native apps is the best idea...

### Current Limitations

These are things that I would like to fix eventually, but will currently stay, either because they are too hard to fix, or would require modifying the Firefox source. I will appreciate any help to fix them.

* **New windows become disconnected from the original PWA:**

  This only applies to windows opened by PWAs (for example, using `target="_blank"` links or `window.open`) and windows opened by shift-clicking on links, and *not* windows opened by a user with app/context menus or keyboard shortcuts.

  On Windows, this means new windows will use the normal Firefox icon and probably merge with the normal Firefox shortcut in the taskbar. On all operating systems, it will also cause them to lose functionality of changing window colors and will always have an address bar displayed.

  This could be fixed if there is an easy way to intercept the opening of every new window, and pass it `window.gFFPWASiteConfig` from the original window just after it is created. I implemented this for some windows (mainly those opened by users), but don't know how to do it for all windows.

* **All PWAs are merged with the first PWA that was opened (Linux & macOS):**

  When some PWA is already running, all newly launched PWAs will merge with it and remain merged until all of them are closed. This will cause the app menu to display all PWAs as part of the first PWA that was launched, with its icon and desktop actions (if any).

  *Users can prevent by installing each PWA into a different profile.*

  * **Linux:**

    This cannot be fixed easily. The native part of the project currently launches Firefox with the `--class` argument, which should set the `WM_CLASS` property of the window to the PWA ID. However, because all Firefox processes in the same profile are connected together, all windows have WM_CLASS of the first PWA. Fixing this would probably require modifying Firefox C++ code. Check [this comment](https://github.com/filips123/FirefoxPWA/issues/33#issuecomment-887382593) and related discussions for ideas and possible solutions to fix this.

  * **macOS:**

    Apple only allows a process to be associated with a single application at all times. Perhaps this could be solved by using an IPC link between a host process and the main Firefox runtime process, the same way the Firefox parent process handles it's content processes. This is just a wild theory though and has to be investigated further. See [this comment](https://github.com/filips123/FirefoxPWA/issues/33#issuecomment-888511078) for more.

## Versioning

The project uses [SemVer](https://semver.org/) for versioning. For the available versions and the changelog, see [the releases](https://github.com/filips123/FirefoxPWA/releases) on this repository.

The native and extension part of the project at released tags are compatible with each other according to SemVer. The native and extension part at non-tagged commits may not be compatible with each other, because they are development versions that may not be both updated at the same time.

The project aims for compatibility with the latest stable Firefox version. It may not be compatible with the others.

## License

The project is licensed under the Mozilla Public License 2.0. By using, redistributing, or modifying it, you must agree to the license, and the additional clauses provided below. See the [LICENSE](LICENSE) file for the full license text.

Browser chrome modifications were largely inspired by the [`xiaoxiaoflood/firefox-scripts`](https://github.com/xiaoxiaoflood/firefox-scripts) repository on GitHub, also licensed under the Mozilla Public License 2.0. Detailed license information can be found in the respective files.

The native part of the project includes the [Metropolis Semi Bold](https://fontsarena.com/metropolis-by-chris-simpson/) typeface by Chris Simpson, released into the public domain using the [Unlicense](https://unlicense.org/).

Windows installer includes the [Material Design Icons](https://materialdesignicons.com/) by Austin Andrews and Google, licensed under the [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) license. Detailed license information can be found in the [WiX configuration file](native/packages/wix/main.wxs).

The project logo is based on the [official Firefox browser logo](https://mozilla.design/firefox/logos-usage) and the [community-introduced PWA logo](https://github.com/webmaxru/progressive-web-apps-logo).

Installing the runtime on Windows will install the [7-Zip](https://7-zip.org/) if it is not already installed. The 7-Zip project is made by Igor Pavlov and [licensed under the GNU LGPL license and others](https://7-zip.org/license.txt). This project is not affiliated with the 7-Zip project or its developers in any way.

Installing the runtime on any system will download the unmodified [Mozilla Firefox](https://www.mozilla.org/firefox/) and locally modify it. By using this project you also agree to the [Firefox Privacy Notice](https://www.mozilla.org/privacy/firefox/). Firefox is licensed under the Mozilla Public License 2.0. Firefox and the Firefox logo are trademarks of the Mozilla Foundation in the U.S. and other countries. This project is not affiliated with the Mozilla Foundation in any way.
