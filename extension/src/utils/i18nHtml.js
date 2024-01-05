import * as DOMPurify from 'dompurify'

import { EVENT_LOCALIZATION_READY } from '../utils'
import { getCurrentLocale, getMessage } from './i18n'

const allowedTags = ['em', 'strong', 'kbd', 'code', 'a']

async function applyElementLocalization (element) {
  for (const { name: attribute, value: key } of element.attributes) {
    // Support for translating the main content
    if (attribute === 'data-i18n' && key) {
      const message = await getMessage(key)
      if (message) applyMessage(element, message)
    }

    if (!attribute.startsWith('data-i18n-') || !key) continue

    // Support for translating arbitrary attributes
    const target = attribute.replace('data-i18n-', '')
    const message = await getMessage(key)
    if (message) element.setAttribute(target, message)
  }
}

function applyMessage (element, message) {
  // Set the element content for messages without HTML
  if (message.indexOf('<') === -1) {
    element.textContent = message
    return
  }

  // Sanitize the HTML message and set it to the element
  const sanitized = DOMPurify.sanitize(message, {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_TAGS: allowedTags,
    ADD_ATTR: ['target']
  })
  element.replaceChildren(sanitized)
}

;(async function () {
  await Promise.all(Array.prototype.map.call(document.querySelectorAll('[data-i18n]'), element => applyElementLocalization(element)))
  document.querySelector('html').setAttribute('lang', await getCurrentLocale())
  document.dispatchEvent(new Event(EVENT_LOCALIZATION_READY))
})()
