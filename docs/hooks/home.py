"""Generate JSON-LD schema for the homepage."""

from __future__ import annotations

from typing import TYPE_CHECKING
from urllib.parse import urljoin

if TYPE_CHECKING:
    from typing import Any
    from mkdocs.config.base import MkDocsConfig
    from mkdocs.structure.nav import Navigation
    from mkdocs.structure.pages import Page


def on_page_context(context: dict[str, Any], page: Page, config: MkDocsConfig, nav: Navigation):
    if not page.is_homepage:
        return

    common = {
        "name": "Progressive Web Apps for Firefox",
        "alternateName": ["PWAsForFirefox", "FirefoxPWA"],
        "description": config.site_description,
        "image": urljoin(config.site_url, "assets/icons/favicon.svg"),
        "url": config.site_url,
        "sameAs": [
            "https://github.com/filips123/PWAsForFirefox",
            "https://addons.mozilla.org/firefox/addon/pwas-for-firefox",
        ],
    }

    website = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        **common,
        "potentialAction": {
            "@type": "SearchAction",
            "target": {
                "@type": "EntryPoint",
                "urlTemplate": urljoin(config.site_url, "?q={search_term_string}"),
            },
            "query-input": "required name=search_term_string",
        },
    }

    application = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        **common,
        "installUrl": "https://addons.mozilla.org/firefox/addon/pwas-for-firefox",
        "releaseNotes": "https://github.com/filips123/PWAsForFirefox/releases",
        "license": "https://github.com/filips123/PWAsForFirefox#license",
        "applicationCategory": ["UtilitiesApplication", "BrowserApplication"],
        "operatingSystem": ["Windows", "Linux", "macOS"],
        "softwareHelp": [
            {
                "@type": "Webpage",
                "url": config.site_url,
            },
            {
                "@type": "Webpage",
                "url": "https://github.com/filips123/PWAsForFirefox",
            }
        ],
        "hasPart": [
            {
                "@type": "CreativeWork",
                "name": "PWAsForFirefox Extension",
                "url": [
                    "https://addons.mozilla.org/firefox/addon/pwas-for-firefox",
                    "https://github.com/filips123/PWAsForFirefox/tree/main/extension",
                ]
            },
            {
                "@type": "CreativeWork",
                "name": "PWAsForFirefox Native",
                "url": [
                    "https://repology.org/project/firefoxpwa",
                    "https://packagecloud.io/filips/FirefoxPWA",
                    "https://github.com/filips123/PWAsForFirefox/tree/main/native",
                ]
            }
        ],
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD",
        },
        "subjectOf": {
            "@type": "WebSite",
            "url": "./",
        },
    }

    if "schema" not in page.meta:
        page.meta["schema"] = []

    if not isinstance(page.meta["schema"], list):
        page.meta["schema"] = [page.meta["schema"]]

    page.meta["schema"].extend([
        website,
        application,
    ])
