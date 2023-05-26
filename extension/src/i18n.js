/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const i18n = browser.i18n
const allowedTags = ['em', 'strong', 'b', 'i', 'kbd', 'code', 'span', 'a', 'br']

const placeholderWithAcutualUrl = {
  '%MPL2.0%': 'https://www.mozilla.org/MPL/2.0/',
  '%SVGREPO%': 'https://www.svgrepo.com/svg/40267/fox',
  '%CC0%': 'https://creativecommons.org/publicdomain/zero/1.0/',
  '%PWALOGO%': 'https://github.com/webmaxru/progressive-web-apps-logo',
  '%FIREFOX-SCRIPTS%': 'https://github.com/xiaoxiaoflood/firefox-scripts',
  '%FIREFOX-UI-FIX%': 'https://github.com/black7375/Firefox-UI-Fix',
  '%FIREFOX-SOURCE-CODE%': 'https://github.com/mozilla/gecko-dev',
  '%METROPOLIS%': 'https://fontsarena.com/metropolis-by-chris-simpson/',
  '%UNLICENSE%': 'https://unlicense.org/',
  '%ICON-BOOTSTRAP%': 'https://icons.getbootstrap.com/',
  '%MIT%': 'https://opensource.org/licenses/MIT',
  '%WIX-CONFIG%': 'https://github.com/filips123/PWAsForFirefox/blob/main/native/packages/wix/main.wxs',
  '%7-ZIP%': 'https://7-zip.org/',
  '%7-Zip-LICENSE%': 'https://7-zip.org/license.txt',
  '%MOZILLA-FIREFOX%': 'https://www.mozilla.org/firefox/',
  '%FIREFOX-PRIVACY-NOTICE': 'https://www.mozilla.org/privacy/firefox/',
  '%FIREFOX-DOWNLOAD%': 'https://www.mozilla.org/firefox/all/',
  '%WINGET%': 'https://github.com/microsoft/winget-cli#installing-the-client',
  '%CHOCOLATEY%': 'https://chocolatey.org/install',
  '%NPACKD%': 'https://www.npackd.org/',
  '%PORTABLEAPPS%': 'https://portableapps.com/download',
  '%PACKEAGE-CLOUD-FIREFOXPWA%': 'https://packagecloud.io/filips/FirefoxPWA',
  '%AUR-FIREFOXPWA%': 'https://aur.archlinux.org/packages/firefox-pwa/',
  '%AUR-FirefoxPWA-BIN%': 'https://aur.archlinux.org/packages/firefox-pwa-bin/',
  '%CARGO-MAKE%': 'https://github.com/sagiegurari/cargo-make',
  '%WIX-TOOLSET%': 'https://wixtoolset.org/releases/',
  '%PWAsForFirefox-REPO%': 'https://github.com/filips123/PWAsForFirefox',
  '%BREW%': 'https://brew.sh/',
  '%RELEASE-NOTES%': 'https://github.com/filips123/PWAsForFirefox/releases'
}

const localizeFunctions = {
  localizeText: {
    applyPlainTextLocalize: function () {
      const localizeTargets = document.querySelectorAll('[data-i18n-id]')
      localizeTargets.forEach(elem => {
        const key = elem.getAttribute('data-i18n-id')
        const message = i18n.getMessage(key)

        if (message) {
          elem.textContent = message
        }
      })
    },
    applyInnerHtmlLocalize: function () {
      const innerHTMLTargets = document.querySelectorAll('[data-i18n-innerHTML]')
      innerHTMLTargets.forEach(elem => {
        const key = elem.getAttribute('data-i18n-innerHTML')
        const translateMessage = i18n.getMessage(key)
        const checkedMessage = localizeFunctions.checkTranslationTextSafe.checkIsTranslationTextSafe(key, translateMessage)

        if (checkedMessage === true) {
          // Replace placeholder URL with actual URL ex: '%firefox.com%' > https://firefox.com
          let modifiedMessage = translateMessage
          for (const [placeholder, url] of Object.entries(placeholderWithAcutualUrl)) {
            const placeholderRegex = new RegExp(placeholder, 'g')
            modifiedMessage = modifiedMessage.replace(placeholderRegex, url)
          }

          elem.innerHTML = modifiedMessage
        } else {
          // URL or HTML tag is not allowed. Show error message in the console.
          console.error(checkedMessage)
          elem.innerText = translateMessage
        }
      })
    },
    applyPlaceholderLocalize: function () {
      const placeholderTargets = document.querySelectorAll('[data-i18n-placeholder]')
      placeholderTargets.forEach(elem => {
        const key = elem.getAttribute('data-i18n-placeholder')
        const message = i18n.getMessage(key)

        if (message) {
          elem.placeholder = message
        }
      })
    }
  },
  checkTranslationTextSafe: {
    checkIsTranslationTextSafe: function (key, text) {
      const tagRegex = new RegExp(`< ?(?!(${allowedTags.join('|')})\\b)[^>]+>`, 'gi')
      const urlRegex = /https?:\/\/\S+/gi
      const unsafeTags = []

      text.replace(tagRegex, match => {
        const tagName = match.replace(/<\/?([^>\s]+).*/, '$1')
        if (!allowedTags.includes(tagName) && !unsafeTags.includes(tagName)) {
          unsafeTags.push(tagName)
        }
      })

      if (urlRegex.test(text)) {
        return `${key} is not safe. Direct URL insertion is not allowed.`
      }

      if (unsafeTags.length > 0) {
        return `${key} is not safe. Do not use the following HTML tags in the translation: ${unsafeTags.join(', ')}`
      }

      return true
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  localizeFunctions.localizeText.applyPlainTextLocalize()
  localizeFunctions.localizeText.applyInnerHtmlLocalize()
  localizeFunctions.localizeText.applyPlaceholderLocalize()
})
