/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function localize () {
  const i18n = browser.i18n

  const localizeTargets = document.querySelectorAll('[data-i18n-id]')
  localizeTargets.forEach(elem => {
    const key = elem.getAttribute('data-i18n-id')
    const message = i18n.getMessage(key)

    if (message) {
      elem.textContent = message
    }
  })

  const innerHTMLTargets = document.querySelectorAll('[data-i18n-innerHTML]')
  innerHTMLTargets.forEach(elem => {
    const key = elem.getAttribute('data-i18n-innerHTML')
    const message = i18n.getMessage(key)

    if (message) {
      elem.innerHTML = message
    }
  })

  const placeholderTargets = document.querySelectorAll('[data-i18n-placeholder]')
  placeholderTargets.forEach(elem => {
    const key = elem.getAttribute('data-i18n-placeholder')
    const message = i18n.getMessage(key)

    if (message) {
      elem.placeholder = message
    }
  })
}

window.addEventListener('DOMContentLoaded', localize)
