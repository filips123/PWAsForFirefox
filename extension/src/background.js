import {
  AUTO_LAUNCH_PERMISSIONS,
  checkNativeStatus,
  launchSite,
  obtainSiteList,
  PREF_AUTO_LAUNCH_EXCLUSION,
  PREF_DISPLAY_PAGE_ACTION,
  PREF_ENABLE_AUTO_LAUNCH,
  PREF_SHOW_UPDATE_POPUP
} from './utils'

// == INSTALL AND UPDATE HANDLING

const updateNotification = 'update-available-notification'

// Display the installation page when extension is installed
// Display the update notification when the extension is updated
browser.runtime.onInstalled.addListener(async ({ reason }) => {
  switch (reason) {
    case 'install':
      await browser.tabs.create({ url: browser.runtime.getURL('setup/install.html') })
      break
    case 'update':
      if (
        (await browser.storage.local.get({ [PREF_SHOW_UPDATE_POPUP]: true }))[PREF_SHOW_UPDATE_POPUP] &&
        (await checkNativeStatus()) !== 'ok'
      ) {
        await browser.notifications.create(updateNotification, {
          title: 'PWAsForFirefox Update',
          message: 'A PWAsForFirefox update is available. Please click the notification to display the update instructions.',
          iconUrl: browser.runtime.getURL('images/addon-logo.svg'),
          type: 'basic'
        })
      }
  }
})

// Open the update page when the update notification is clicked
browser.notifications.onClicked.addListener(async notification => {
  if (notification !== updateNotification) return
  await browser.tabs.create({ url: browser.runtime.getURL('setup/update.html') })
})

// == CONTENT SCRIPT HANDLING

// Detect manifest sent from content script
browser.runtime.onMessage.addListener(async ({ manifestUrl, documentUrl }, { tab }) => {
  manifestUrl = manifestUrl ? new URL(manifestUrl) : undefined
  documentUrl = documentUrl ? new URL(documentUrl) : undefined

  // Check status of the native program and hide page action if needed
  switch (await checkNativeStatus()) {
    case 'install':
    case 'update-major':
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

// == PERMISSION HANDLING

// Reload the extension after auto launch permissions have been added
// Or disable the preference if permissions have been revoked
const permissionsListener = async () => {
  // Disable the preference if permissions are not correct
  const permissionsOk = await browser.permissions.contains(AUTO_LAUNCH_PERMISSIONS)
  if (!permissionsOk) await browser.storage.local.set({ [PREF_ENABLE_AUTO_LAUNCH]: false })

  // Reload the extension so listeners become registered
  const preferenceEnabled = (await browser.storage.local.get(PREF_ENABLE_AUTO_LAUNCH))[PREF_ENABLE_AUTO_LAUNCH]
  if (permissionsOk && preferenceEnabled) browser.runtime.reload()
}

browser.permissions.onAdded.addListener(permissionsListener)
browser.permissions.onRemoved.addListener(permissionsListener)

// == LAUNCH ON WEBSITE HANDLING

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

    // Get auto launch extension settings
    const settings = await browser.storage.local.get([PREF_ENABLE_AUTO_LAUNCH, PREF_AUTO_LAUNCH_EXCLUSION])

    // Only handle when the auto launch feature is enabled
    if (!settings[PREF_ENABLE_AUTO_LAUNCH]) return

    // Do not handle excluded URLs
    const pattern = settings[PREF_AUTO_LAUNCH_EXCLUSION]
    const re = new RegExp(pattern)
    if (pattern && re.test(details.url)) return

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
  // Get auto launch extension settings
  const settings = await browser.storage.local.get([PREF_ENABLE_AUTO_LAUNCH, PREF_AUTO_LAUNCH_EXCLUSION])

  // Only handle when the auto launch feature is enabled
  if (!settings[PREF_ENABLE_AUTO_LAUNCH]) return

  // Do not handle excluded URLs
  const pattern = settings[PREF_AUTO_LAUNCH_EXCLUSION]
  const re = new RegExp(pattern)
  if (pattern && re.test(details.url)) return

  // Find the matching web app
  const site = await getMatchingUrlHandler(details.url)
  if (!site) return

  // Close the newly opened tab/window
  await browser.tabs.remove(details.tabId)
})

// = LAUNCH ON BROWSER HANDLING

browser.runtime.onStartup.addListener(async () => {
  for (const site of Object.values(await obtainSiteList())) {
    if (site.config.launch_on_browser) {
      await launchSite(site)
    }
  }
})
