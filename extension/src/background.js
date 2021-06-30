// Display page on installation or update to notify users that they need to install/update the native program
browser.runtime.onInstalled.addListener(async ({ reason, temporary }) => {
  switch (reason) {
    case 'install':
      await browser.tabs.create({ url: browser.runtime.getURL('setup/install.html') })
      break
    case 'update':
      await browser.tabs.create({ url: browser.runtime.getURL('setup/update.html') })
      break
  }
})

// TODO: Periodically check if the native program is not installed and then disable actions/popups and open install page

// Detect manifest sent from content script
browser.runtime.onMessage.addListener(({ manifest: manifestUrl }, { url: documentUrl, tab }) => {
  manifestUrl = new URL(manifestUrl)
  documentUrl = new URL(documentUrl)

  // If both manifest and the page are in the same origin and are loaded over HTTPS, site is a valid web app
  if (manifestUrl.origin === documentUrl.origin && manifestUrl.protocol === 'https:') {
    // Set popup to the install page and show it
    // TODO: Create launch page for sites that are already installed
    browser.pageAction.setPopup({ tabId: tab.id, popup: 'sites/install.html' })
    browser.pageAction.show(tab.id)
  } else {
    // Hide the popup
    browser.pageAction.hide(tab.id)
  }
})
