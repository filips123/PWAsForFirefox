"""Generate the microdata schema for the FAQ page."""

from __future__ import annotations

from typing import TYPE_CHECKING

from bs4 import BeautifulSoup

if TYPE_CHECKING:
    from typing import Any
    from mkdocs.config.base import MkDocsConfig
    from mkdocs.structure.nav import Navigation
    from mkdocs.structure.pages import Page


def construct(document, container, question, answer):
    if not question or not answer:
        return

    # Move question text into span, so the paragraph sign is not copied to microdata
    name = document.new_tag("span", itemprop="name")
    for child in list(question.children):
        if child.name == "a" and "headerlink" in child.get("class", []):
            continue
        name.append(child.extract())
    question.insert(0, name)

    # Construct the accepted answer from the source elements
    accepted = document.new_tag("div", itemscope="", itemprop="acceptedAnswer", itemtype="https://schema.org/Answer")
    text = document.new_tag("div", itemprop="text")
    text.extend(answer)
    accepted.append(text)

    # Create an question entry element and append question and accepted answer
    entry = document.new_tag("div", itemscope="", itemprop="mainEntity", itemtype="https://schema.org/Question")
    entry.append(question)
    entry.append(accepted)
    container.append(entry)


def on_page_context(context: dict[str, Any], page: Page, config: MkDocsConfig, nav: Navigation):
    if not page.url == "help/faq/":
        return

    original = BeautifulSoup(page.content, features="lxml")
    modified = BeautifulSoup("", features="lxml")

    # All questions and answers need to be inside the FAQPage container
    container = modified.new_tag("div", itemscope="", itemtype="https://schema.org/FAQPage")
    modified.append(container)

    question = None
    answer = []

    for element in list(original.body.children):
        # Copy styles and scripts to the target
        if element.name in ("style", "script", "h1"):
            container.insert_before(element)

        # Parse section and question headings
        if element.name in ("h2", "h3"):
            # Construct the previous question and reset parser
            construct(modified, container, question, answer)
            question = None
            answer = []

            if element.name == "h2":
                # Copy the section heading to the container
                container.append(element)

            elif element.name == "h3":
                # Copy the question to the parser
                question = element

            continue

        # Copy the answer to the parser
        answer.append(element)

    # Construct the final question
    construct(modified, container, question, answer)

    # Replace the page content
    page.content = str(modified)
