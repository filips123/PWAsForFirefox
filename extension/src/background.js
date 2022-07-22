import {
  AUTO_LAUNCH_PERMISSIONS,
  checkNativeStatus,
  obtainSiteList,
  PREF_DISPLAY_PAGE_ACTION,
  PREF_ENABLE_AUTO_LAUNCH
} from './utils'

// Display install/update page when extension is installed/updated to notify users
browser.runtime.onInstalled.addListener(async ({ reason }) => {
  const nativeStatus = await checkNativeStatus()
  if (nativeStatus === 'ok') return

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
browser.runtime.onMessage.addListener(async ({ manifestUrl, documentUrl }, { tab }) => {
  manifestUrl = manifestUrl ? new URL(manifestUrl) : undefined
  documentUrl = documentUrl ? new URL(documentUrl) : undefined

  // Check status of the native program and hide page action if needed
  switch (await checkNativeStatus()) {
    case 'install':
    case 'update-required':
      await browser.pageAction.hide(tab.id)
      return
  }

  // If both manifest and the page are loaded over HTTPS, site is a valid web app
  let isValidPwa = manifestUrl && manifestUrl.protocol === 'https:' && documentUrl.protocol === 'https:'

  // Force show or hide the page action depending on user preference
  const settingsDisplayPageAction = (await browser.storage.local.get(PREF_DISPLAY_PAGE_ACTION))[PREF_DISPLAY_PAGE_ACTION]
  if (settingsDisplayPageAction === 'always') isValidPwa = true
  if (settingsDisplayPageAction === 'never') isValidPwa = false

  if (isValidPwa) {
    // Check if this site is already installed
    const existingSites = Object.values(await obtainSiteList()).map(site => site.config.manifest_url)
    const siteInstalled = manifestUrl && existingSites.includes(manifestUrl.toString())

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

    // Show the page action
    await browser.pageAction.show(tab.id)
  } else {
    // Hide the page action
    await browser.pageAction.hide(tab.id)
  }
})

// Reload the extension after auto launch permissions have been added
// Or disable the preference if permissions have been revoked
const permissionsListener = async () => {
  // Disable the preference if permissions are not correct
  const permissionsOk = await browser.permissions.contains(AUTO_LAUNCH_PERMISSIONS)
  if (!permissionsOk) await browser.storage.local.set({ [PREF_ENABLE_AUTO_LAUNCH]: false })

  // Reload the extension so listeners become registered
  const preferenceEnabled = (await browser.storage.local.get([PREF_ENABLE_AUTO_LAUNCH]))[PREF_ENABLE_AUTO_LAUNCH]
  if (permissionsOk && preferenceEnabled) browser.runtime.reload()
}

browser.permissions.onAdded.addListener(permissionsListener)
browser.permissions.onRemoved.addListener(permissionsListener)

// Handle opening new URLs and redirect enable URLs to web apps
// This will obtain site list for every request (twice) which will impact performance
// In the future, we should find a way to cache it and only update it when it changes

const getMatchingUrlHandler = async target => {
  target = new URL(target)

  for (const site of Object.values(await obtainSiteList())) {
    if (site.config.enabled_url_handlers?.some(handler =>
      target.origin === new URL(handler).origin &&
      target.pathname.startsWith(new URL(handler).pathname)
    )) {
      return site
    }
  }
}

browser.webRequest?.onBeforeRequest.addListener(
  async details => {
    // Only handle top-level GET requests
    if (details.type !== 'main_frame' || details.method !== 'GET') return

    // Only handle when the auto launch feature is enabled
    const autoLaunch = (await browser.storage.local.get([PREF_ENABLE_AUTO_LAUNCH]))[PREF_ENABLE_AUTO_LAUNCH]
    if (!autoLaunch) return

    // Find the matching web app
    const site = await getMatchingUrlHandler(details.url)
    if (!site) return

    // Launch the web app on target URL
    await browser.runtime.sendNativeMessage('firefoxpwa', {
      cmd: 'LaunchSite',
      params: { id: site.ulid, url: details.url }
    })

    // Prevent the request
    return { cancel: true }
  },
  { urls: ['<all_urls>'] },
  ['blocking']
)

browser.webNavigation?.onCreatedNavigationTarget.addListener(async details => {
  // Only handle when the auto launch feature is enabled
  const autoLaunch = (await browser.storage.local.get([PREF_ENABLE_AUTO_LAUNCH]))[PREF_ENABLE_AUTO_LAUNCH]
  if (!autoLaunch) return

  // Find the matching web app
  const site = await getMatchingUrlHandler(details.url)
  if (!site) return

  // Close the newly opened tab/window
  await browser.tabs.remove(details.tabId)
})
