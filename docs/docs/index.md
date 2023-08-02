---
hide:
  - path
---

<style>
.md-sidebar--primary {
  visibility: hidden;
}
</style>

<div style="text-align:center;">
<h1 style="margin-bottom:0.35em;">Progressive Web Apps for Firefox</h1>
<em>A tool to install, manage and use Progressive Web Apps (PWAs) in Mozilla Firefox.</em>
</div>

<div style="text-align:center;" markdown>

[![Release](https://img.shields.io/github/v/release/filips123/PWAsForFirefox?sort=semver&style=flat-square&cacheSeconds=3600)](https://github.com/filips123/PWAsForFirefox/releases/latest)
[![Users](https://img.shields.io/amo/users/pwas-for-firefox?style=flat-square&cacheSeconds=86400)](https://addons.mozilla.org/firefox/addon/pwas-for-firefox/)
[![Rating](https://img.shields.io/amo/rating/pwas-for-firefox?style=flat-square&cacheSeconds=86400)](https://addons.mozilla.org/firefox/addon/pwas-for-firefox/reviews/)
[![License](https://img.shields.io/github/license/filips123/PWAsForFirefox?style=flat-square&cacheSeconds=86400)](https://github.com/filips123/PWAsForFirefox/blob/main/LICENSE)
[![Repositories](https://img.shields.io/repology/repositories/firefoxpwa?style=flat-square&cacheSeconds=86400)](https://repology.org/project/firefoxpwa/versions)
[![Packagecloud.io DEB](https://img.shields.io/badge/deb-packagecloud.io-844fec.svg?style=flat-square)](https://packagecloud.io/filips/FirefoxPWA)
[![Packagecloud.io RPM](https://img.shields.io/badge/rpm-packagecloud.io-844fec.svg?style=flat-square)](https://packagecloud.io/filips/FirefoxPWA)

</div>

---

<!-- Once MkDocs Material card grids are publicly available (Goat's Horn) -->
<!-- We can try to use them to make this page look better and more "attractive" -->
<!-- Also add links to specific documentation pages, screenshots, descriptions, etc. -->

## About {: style="margin-top:0;" }

[Progressive Web Apps (PWAs)](https://developer.mozilla.org/docs/Web/Progressive_web_apps)
are web apps that use web APIs and features along with progressive enhancement strategy to
bring a native app-like user experience to cross-platform web applications. Although
Firefox supports many of Progressive Web App APIs, it does not support functionality to
install them as a standalone system app with an app-like experience. This functionality is
often also known as a Site Specific Browser (SSB).

This project creates a custom modified Firefox runtime to allow websites to be installed
as standalone apps and provides a console tool and browser extension to install, manage
and use them.

!!! tip

    You can see more details about the project in [the repository README file](https://github.com/filips123/PWAsForFirefox),
    where you can also star the project. :star:

    You should also check [our FAQ page](help/faq.md) and [the about section](about/how-it-works.md)
    if you want more details about the project.

## Usage

!!! tip

    You should install [the browser extension](https://addons.mozilla.org/firefox/addon/pwas-for-firefox/)
    and follow in-browser installation instructions.

You can check [the installation page](installation/requirements.md) for more details about
installing and setting up the project. For detailed usage instructions, please also check out
[the user guide](user-guide/extension.md) and related pages.

<!-- If you are a developer who wants to integrate PWAsForFirefox with your own projects
and applications, please check out [the developer guide](TODO). -->

If you have problems setting up or using the project, or other questions about the project,
please check [the help section](help/support.md), especially [the FAQ page](help/faq.md).

## Features

<!-- This part is currently shared between the main README, homepage and features page -->
<!-- We should try to do something about this in the future -->

* Command-line tool to install, manage and run Progressive Web Apps in Firefox.
* Extension to set up native programs, and install, manage and run PWAs and their profiles directly from the main Firefox browser.
* Isolated Firefox installation and profile(s) that stores the PWAs.
* Installed PWAs have their own start/app menu entry and taskbar icon, and live in their own window.
* Installed PWAs have tabs and address bar for a better app-like feel.
* Support for installing all websites as Progressive Web Apps.
* Support for all Firefox addons/extensions and built-in Firefox features.
* Support for automatic (user-triggered) installation and patching of installation and profile(s).

You can see a full list of features [on a dedicated page](about/supported-features.md).

## Supporters

<!-- Headings here need to use HTML, so they don't appear in the table of contents -->

<h3>Sponsors</h3>

Thanks to [packagecloud.io](https://packagecloud.io/) for sponsoring this project and
providing us a free hosting for our DEB and RPM packages!

[![Private NPM repository and Maven, RPM, DEB, PyPi and RubyGems repository · packagecloud](https://assets-production.packagecloud.io/assets/packagecloud-logo-light-7fa6e801ee96415eed86693c85c4b0bbb20f9cf2b63fc11736ab597661fb5c0d.png){ loading=lazy width=500 }](https://packagecloud.io/)

Thanks to all donors for providing financial support for the project!
{: style="padding-top:0.5rem;padding-bottom:0.5rem;" }

!!! note

    Please check [supported donation services](about/contributing.md#donations) if you
    want to help the project by donating.

<h3>Contributors</h3>

Thanks to [all contributors](https://github.com/filips123/PWAsForFirefox/graphs/contributors)
to this project for providing help and developing features!

[![Contributors](https://contrib.rocks/image?repo=filips123/PWAsForFirefox){ loading=lazy }](https://github.com/filips123/PWAsForFirefox/graphs/contributors)

<h3>Other Mentions</h3>

Thanks to [all package maintainers](https://repology.org/project/firefoxpwa/information)
making sure the project is up-to-date! Thanks to [all stargazers](https://github.com/filips123/PWAsForFirefox/stargazers)
who starred our repository on GitHub. Finally, thanks to Mozilla and its developers for
creating Firefox and making it possible to modify its UI using JavaScript!

---

<small markdown>**Note:** Parts of this website are still work-in-progress. Please use the
feedback button and open GitHub issues with your feedback and suggestions about potential
improvements. You can also participate [in a GitHub discussion](https://github.com/filips123/PWAsForFirefox/discussions/335)
about the documentation website. Thank you!</small>
