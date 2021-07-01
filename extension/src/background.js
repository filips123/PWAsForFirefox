// Display page on installation or update to notify users that they need to install/update the native program
import { obtainSiteList } from './utils'

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

// TODO: Periodically check if the native program is not installed and then disable actions/popups and open install page

// Detect manifest sent from content script
browser.runtime.onMessage.addListener(async ({ manifest: manifestUrl }, { url: documentUrl, tab }) => {
  manifestUrl = new URL(manifestUrl)
  documentUrl = new URL(documentUrl)

  // If both manifest and the page are in the same origin and are loaded over HTTPS, site is a valid web app
  if (manifestUrl.origin === documentUrl.origin && manifestUrl.protocol === 'https:') {
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
