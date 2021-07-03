import { checkNativeStatus, obtainSiteList } from './utils'

// Display install/update page when extension is installed/updated to notify users
browser.runtime.onInstalled.addListener(async ({ reason }) => {
  switch (reason) {
    case 'install':
      await browser.tabs.create({ url: browser.runtime.getURL('setup/install.html') })
      break
    case 'update':
      await browser.tabs.create({ url: browser.runtime.getURL('setup/update.html') })
      break
  }
})

// Detect manifest sent from content script
browser.runtime.onMessage.addListener(async ({ manifest: manifestUrl }, { url: documentUrl, tab }) => {
  manifestUrl = new URL(manifestUrl)
  documentUrl = new URL(documentUrl)

  // Check status of the native program and hide page action if needed
  switch (await checkNativeStatus()) {
    case 'install':
    case 'update':
      await browser.pageAction.hide(tab.id)
      return
  }

  // If both manifest and the page are loaded over HTTPS, site is a valid web app
  if (manifestUrl.protocol === 'https:' && documentUrl.protocol === 'https:') {
    // Check if this site is already installed
    const existingSites = Object.values(await obtainSiteList()).map(site => site.config.manifest_url)
    const siteInstalled = existingSites.includes(manifestUrl.toString())

    // Set popup to the launch/install page depending on if it is installed
    if (siteInstalled) {
      await browser.pageAction.setIcon({ tabId: tab.id, path: 'images/page-action-launch.svg' })
      browser.pageAction.setTitle({ tabId: tab.id, title: browser.i18n.getMessage('actionLaunchSite') })
      browser.pageAction.setPopup({ tabId: tab.id, popup: 'sites/launch.html' })
    } else {
      await browser.pageAction.setIcon({ tabId: tab.id, path: 'images/page-action-install.svg' })
      browser.pageAction.setTitle({ tabId: tab.id, title: browser.i18n.getMessage('actionInstallSite') })
      browser.pageAction.setPopup({ tabId: tab.id, popup: 'sites/install.html' })
    }

    // Show a popup
    await browser.pageAction.show(tab.id)
  } else {
    // Hide the popup
    await browser.pageAction.hide(tab.id)
  }
})
