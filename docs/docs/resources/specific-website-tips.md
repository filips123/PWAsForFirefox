# Specific Website Tips

## Websites With Multiple Domains

Some websites use multiple domains, for example for Single Sign-on (SSO). This is normally
not a problem, but if you have enabled [the "Open out-of-scope URLs in a default browser"
option](../user-guide/browser.md#open-out-of-scope-urls-in-a-default-browser), those
functionalities may not work properly (for example, you may not be able to log in), as
any out-of-scope domains will be redirected to the default browser. For those websites,
you will have to additionally use [the "Domains always allowed to be opened in the app
browser" option](../user-guide/browser.md#domains-always-allowed-to-be-opened-in-the-app-browser)
to set domains that should always be opened in the app browser.

We maintain a list of recommended values for some popular websites and services where this
is needed. If you know another popular website that is not already listed, or would like
to change something in this list, please create a new issue or PR.

| Website                | Domains                                    |
|------------------------|--------------------------------------------|
| Apple                  | `appleid.apple.com`                        |
| Facebook, Instagram    | `www.facebook.com`                         |
| Google, Gmail, YouTube | `accounts.google.com`                      |
| Microsoft, Outlook     | `login.live.com,login.microsoftonline.com` |
| Proton                 | `account.proton.me`                        |
| Spotify                | `accounts.spotify.com`                     |

## Websites With Invalid Manifests

Some websites cannot be installed with the manifest enabled because their manifests are
invalid or do not follow the specifications properly. To install such websites, you can
try disabling the use of manifest for determining the app properties.

We maintain a list of known websites with those problems. If you have a problem installing
another website that is not on this list, please create a new issue or PR. If you believe
that a website on this list follows the specifications, but cannot be installed because
of a bug in PWAsForFirefox, please create a new issue.

| Website                           | Details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Issue                                                        |
|-----------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------|
| [Reddit](https://www.reddit.com/) | Reddit's manifest contains `shortcuts` items that use relative URLs. According [to the manifest specification](https://w3c.github.io/manifest/#processing-shortcut-items), shortcut URLs should be parsed with the manifest URL as the base URL, and the resulting URL should be within the scope (which is determined based on the document URL). Because the manifest is located on a different domain than the main website, shortcuts will be parsed with the wrong URL as a base and fail the required checks. | [#61](https://github.com/filips123/PWAsForFirefox/issues/61) |
