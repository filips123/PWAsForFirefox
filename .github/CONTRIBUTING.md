# Contributing

Thank you very much for considering contributing to this project!

## Issue Tracker

### Bug Reports

If you are having problems with the project, please make sure that you have
read the documentation, especially [the FAQ page](https://pwasforfirefox.filips.si/help/faq/).
Before creating bug reports, please also check for any similar issues or pull
requests. If any of them already exists, please participle in that one.

If you cannot determine and fix the problem yourself, please open a new issue
and provide all the required information. If you were able to fix the problem, but
you think the same problem might happen to other users, please report it and
include your fix, so other users can find and fix it.

When you are creating a bug report, please include as many details as possible.
Fill out the required template, as that information will help us resolve it faster.
[Our troubleshooting tasks](https://pwasforfirefox.filips.si/help/troubleshooting/)
can help you geather logs and other useful information.

If you found a vulnerability or what you believe is a vulnerability, **do not**
open a public issue or disclose it publicly. Please read our [security policy](SECURITY.md)
for more details and steps for reporting it.

### Feature Requests

Before creating feature requests, please check for any similar issues or
pull requests. If they are already opened, please participle in that one.

If no issues or pull requests that describe your request exist, please
open a new issue with the correct template. Fill the template and describe
your request, as that information will help us implement it faster.

You can also submit a pull request with the implementation.

### Discussions

For general discussions, project ideas, and support/help questions, please use
[a discussions feature](https://github.com/filips123/PWAsForFirefox/discussions)
instead of the issue tracker. This will ensure the issue tracker stays clean,
so we can focus on fixing bugs and resolving feature requests.

## Pull Requests

When developing a bug fix or feature, please make sure your code adheres to
the code style and is properly linted. You can check the READMEs of the native
and extension parts for more details.

If possible, test your feature on all supported operating systems, and make
sure it works correctly. If developing a system integration, test it on multiple
desktop environments. Please also check existing features to make sure they
still work correctly.

When submitting a pull request, describe what have you done and which issues
have you fixed. Include as many useful details as possible, to make it possible
to review it quickly. If required, fix any additional requests.

Any contribution intentionally submitted for inclusion in this repository
shall be, unless specified otherwise, licensed under the Mozilla Public
License 2.0, without any additional terms or conditions. By using,
redistributing, or modifying it, you must agree to the license,
and the additional clauses provided [in the README file](../README.md#License).

## Translations

You can contribute translations on [Crowdin](https://crowdin.com/project/firefoxpwa).
Please make sure you write your messages correctly and in a consistent style. If
you have any questions or suggestions, both for new and existing translations and
messages, please use Crowdin's discussions feature to communicate with others.

If your language is not yet available, please contact me on Crowdin.

If possible, please start with the UserChrome translations, and then continue
with the extension translations, as UserChrome translations are shorter and
more beneficial to be translated.

<details>
  <summary>Expand localization status</summary>

  [![Localization Status](https://badges.awesome-crowdin.com/translation-13220281-466834.png)](https://crowdin.com/project/firefoxpwa)
</details>

### Extension Translations

The extension uses a custom message format, mostly compatible with the standard
WebExtensions message format, with a few differences:

* Message keys are case-sensitive, unlike in WebExtensions.
* Message placeholders remain case-insensitive, like in WebExtensions.
* Positional placeholders are unsupported, use named placeholders instead.
* Referencing other messages is possible, include a placeholder to another key in the placeholder content.
* Limited pluralization is possible, supporting a very basic subset of the ICU message pluralization format.

The pluralization support is based on a very basic subset of the ICU message
pluralization syntax, with the following limitations:

* Supports only the pluralization type (`plural`).
* Supports only one variable key.
* Does not support nested messages.
* Only supports `#` placeholder inside messages.

As Crowdin is compatible with this format, you mostly don't need to worry about
these changes if you are translating through Crowdin. More details about special
features can be found [in a Crowdin discussion](https://crowdin.com/project/firefoxpwa/discussions/2).

<details>
  <summary>Notes for developers</summary>

The localization messages are stored in a WebExtensions-compatible format.
When creating a new message, please make sure that it follows the same
message ID style as other messages and contains an appropriate description.

When creating an HTML element that needs to be translated, add a `data-i18n`
attribute with its content set to the message ID. If you need to translate
specific attributes, you can set `data-i18n-ATTRIBUTE-NAME` to the message
ID. Even if the element only uses attribute translations, it still needs
a `data-i18n` attribute, but it can be empty.

For accessing translated messages through JS, the `getMessage` function
from the `i18n` file can be used.

For accessing messages from the background script, use the standard
`browser.i18n.getMessage` function instead. In this case, make sure
to add the uses message IDs to the `messages` list in `package.json`.
</details>

### UserChrome Translations

The app browser (UserChrome) uses the [Fluent](https://projectfluent.org/)
localization system, which is built directly into Firefox. You can check
the [Fluent Syntax Guide](https://projectfluent.org/fluent/guide/) for
more information.

When translating messages, please make sure they are translated in the same
style and capitalization as existing Firefox messages in your language. Some
files where this is relevant include links to the official Firefox localization
system, where you can check how similar messages are translated there.

You can read more details, suggestions and important things about translating
the app browser [in a Crowdin discussion](https://crowdin.com/project/firefoxpwa/discussions/4).

## Code of Conduct

This project adheres to [the Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/0/code_of_conduct/).
Please uphold this code and report unacceptable behavior to [projects@filips.si](mailto:projects@filips.si).
