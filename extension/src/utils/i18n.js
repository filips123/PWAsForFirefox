import messages from 'locale:../_locales/*/messages.json'

import { PREF_LOCALE } from '../utils'

export const defaultLocale = 'en'

/**
 * Returns the current locale.
 *
 * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#locales_argument
 *
 * @returns {Promise<string>}
 */
export async function getCurrentLocale () {
  return (await browser.storage.local.get(PREF_LOCALE))[PREF_LOCALE] || defaultLocale
}

/**
 * Returns all available locales.
 *
 * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#locales_argument
 *
 * @returns {string[]}
 */
export function getAllLocales () {
  return Object.keys(messages).map(code => code.replace('_', '-'))
}

/**
 * Parses a very basic subset of ICU messages for pluralization.
 *
 * It has the following limitations:
 *
 * * Supports only the pluralization type (`plural`).
 * * Supports only one variable key.
 * * Does not support nested messages.
 * * Only supports `#` placeholder inside messages.
 *
 * @param {string} message
 * @param {number} count
 * @param {string} locale
 *
 * @returns {string}
 */
function parseICUPlural (message, count, locale) {
  const pluralRules = new Intl.PluralRules(locale)

  const stack = []
  const expressions = []
  let start = 0

  for (let i = 0; i < message.length; i++) {
    if (message[i] === '{') {
      if (stack.length === 0) start = i
      stack.push('{')
    } else if (message[i] === '}') {
      stack.pop()
      if (stack.length === 0) expressions.push({ start, end: i })
    }
  }

  for (const { start, end } of expressions.reverse()) {
    const [format, expression] = message.slice(start + 1, end).split(',', 3).slice(1).map(s => s.trim())

    if (format === 'plural') {
      const matches = Object.fromEntries(Array.from(expression.matchAll(/(\w+|=\d+)\s\{([^}]+)}/g)).map(match => [match[1], match[2].trim()]))
      const match = matches[`=${count}`] || matches[pluralRules.select(count)] || matches.other
      message = message.slice(0, start) + match.replace('#', count) + message.slice(end + 1)
    }
  }

  return message
}

/**
 * Gets the localized string for the specified message for the specified locale.
 *
 * @param {string} key
 * @param {string[]} substitutions
 * @param {number?} count
 * @param {string} locale
 *
 * @returns {Promise<string|undefined>}
 */
async function getMessageForLocale (key, substitutions, count, locale) {
  const message = messages?.[locale.replace('-', '_')]?.[key]
  if (!message) return

  let content = message.message

  if (message.placeholders) {
    for (const [placeholderKey, placeholderInfo] of Object.entries(message.placeholders)) {
      let placeholderContent = placeholderInfo.content

      const placeholderRecursive = placeholderContent.match(/^\$(\w+)\$$/)?.[1]
      if (placeholderRecursive) placeholderContent = await getMessage(placeholderRecursive, substitutions, count)

      const placeholderSubstitution = placeholderContent.match(/^\$(\d+)$/)?.[1]
      if (placeholderSubstitution) placeholderContent = substitutions[parseInt(placeholderSubstitution) + 1]

      content = content.replace(new RegExp(`\\$${placeholderKey}\\$`, 'gi'), placeholderContent)
    }
  }

  if (count !== undefined) {
    content = parseICUPlural(content, count, locale)
  }

  return content
}

/**
 * Gets the localized string for the specified message.
 *
 * If the message key exists for the exact current locale, it will be used. Otherwise, if the
 * current locale is qualified with a region, and there is a region-less version of that locale
 * that contains the key, that will be used instead. Otherwise, an English version of a key
 * will be used if it exists. If none of the key exists, the original key will be returned instead.
 *
 * The message format is mostly compatible with the WebExtensions format, but there are a few differences:
 *
 * * Message keys are case-sensitive, unlike in WebExtensions.
 * * Message placeholders remain case-insensitive, like in WebExtensions.
 * * Positional placeholders are unsupported, use named placeholders instead.
 * * Referencing other messages is possible, include a placeholder to another key in the placeholder content.
 * * Limited pluralization is possible, supporting a very basic subset of the ICU message pluralization format.
 *
 * @param {string} key - The message key, as specified in the `messages.json` file.
 * @param {string[]?} substitutions - Substitution strings, if the message requires any.
 * @param {number?} count - The count for the message, if the message requires it.
 *
 * @returns {Promise<string>} - The translated message.
 */
export async function getMessage (key, substitutions, count) {
  const localeWithRegion = await getCurrentLocale()
  const localeWithoutRegion = localeWithRegion.split('-', 1)[0]

  for (const locale of [localeWithRegion, localeWithoutRegion, defaultLocale]) {
    const message = await getMessageForLocale(key, substitutions || [], count, locale)
    if (message) return message
  }

  console.warn(`No translation found: '${key}`)
  return key
}
