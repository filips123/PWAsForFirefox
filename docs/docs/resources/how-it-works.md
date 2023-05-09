# How It Works

The project consists of three parts, the browser extension, the native program, and the
UserChrome browser modifications. These parts are seamlessly integrated together to make
the whole project work. The extension provides in-browser instructions for installation
of the native program, which also installs the UserChrome modifications.

This page can be useful for those who want a bit better understanding of how the project
works and how it is implemented.

## Extension

The browser extension is the main interface users will be facing when using the project.
It provides a convenient way of installing, editing, and removing sites and profiles
directly from their main browser. However, since [browser extensions][link-webextensions]
are limited and cannot directly access the operating system, which is needed for the
installation of web apps, the project uses [Native messaging API][link-native-messaging]
for communication with the native program.

[link-webextensions]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions
[link-native-messaging]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging

## Native Program

The native program is written in [Rust][link-rust] and handles features that the extension
alone cannot do. It communicates with the extension using a native messaging protocol.
Features of the native program include installing Firefox runtime, patching it with the
UserChrome modifications, installing the sites, applying the system integration, and
launching them.

The native program also provides a command-line program for users that prefer CLI to GUI.

[link-rust]: https://www.rust-lang.org/

## UserChrome Modifications

The remaining part of the project is modifying Firefox UI to make a better app-like feel.
This is done using [UserChromeJS (Autoconfig Startup Scripting)][link-userchromejs]
modifications that can execute *low-level* JavaScript code that can modify Firefox UI.
These modifications hide the address bar and tabs, move some browser buttons, provide
additional useful widgets and settings and handle PWA scope and system integration.

[link-userchromejs]: https://www.userchrome.org/what-is-userchrome-js.html
