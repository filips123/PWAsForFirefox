"""Generate JSON-LD breadcrumbs for documentation pages."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Any
    from mkdocs.config.base import MkDocsConfig
    from mkdocs.structure.nav import Navigation
    from mkdocs.structure.pages import Page


def on_page_context(context: dict[str, Any], page: Page, config: MkDocsConfig, nav: Navigation):
    if not page.ancestors:
        return

    elements = [{
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": config.site_url,
    }]

    position = 2

    for ancestor in page.ancestors[::-1]:
        name = ancestor.title

        while ancestor.children:
            ancestor = ancestor.children[0]

        url = ancestor.canonical_url

        elements.append({
            "@type": "ListItem",
            "position": position,
            "name": name,
            "item": url,
        })

        position += 1

    elements.append({
        "@type": "ListItem",
        "position": position,
        "name": page.title,
        "item": page.canonical_url,
    })

    if "schema" not in page.meta:
        page.meta["schema"] = []

    if not isinstance(page.meta["schema"], list):
        page.meta["schema"] = [page.meta["schema"]]

    page.meta["schema"].append({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": elements,
    })
