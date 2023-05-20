/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function localize() {
    let i18n = browser.i18n;
    let localizeTarget = document.querySelectorAll("[data-i18n-id]");
    
    for (let i = 0; i < localizeTarget.length; i++) {
      console.log(localizeTarget[i]);
      let elem = localizeTarget[i];
      let key = elem.getAttribute("data-i18n-id");
      let message = i18n.getMessage(key);
      console.log(message);
    
      if (message) {
        elem.textContent = message;
      }
    }
    
    let innerHTMLTarget = document.querySelectorAll("[data-i18n-innerHTML]");
    for (let i = 0; i < innerHTMLTarget.length; i++) {
      let elem = innerHTMLTarget[i];
      let key = elem.getAttribute("data-i18n-innerHTML");
      let message = i18n.getMessage(key);
    
      if (message) {
        elem.innerHTML = message;
      }
    }
    
    let placeholderTarget = document.querySelectorAll("[data-i18n-placeholder]");
    for (let i = 0; i < placeholderTarget.length; i++) {
      let elem = placeholderTarget[i];
      let key = elem.getAttribute("data-i18n-placeholder");
      let message = i18n.getMessage(key);
    
      if (message) {
        elem.placeholder = message;
      }
    }
}

window.addEventListener("DOMContentLoaded", localize);