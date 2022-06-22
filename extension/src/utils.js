import { gt as semverGt, satisfies as semverSatisfies } from 'semver'

export const PREF_DISPLAY_PAGE_ACTION = 'settings.display-page-action'
export const PREF_LAUNCH_CURRENT_URL = 'settings.launch-current-url'

/**
 * Obtains the manifest and the document URLs by asking the content script of current tab.
 * Also obtains some basic page info that can be used if the manifest does not exist.
 *
 * @returns {Promise<{manifestUrl: string, documentUrl: string, pageInfo: Object}>}
 */
export async function obtainUrls () {
  const tab = (await browser.tabs.query({ active: true, currentWindow: true }))[0]
  return await browser.tabs.sendMessage(tab.id, 'ObtainUrls')
}

/**
 * Obtains and processes the manifest from the URL.
 *
 * @param {string} manifestUrl
 * @param {string} documentUrl
 *
 * @returns {Promise<Object>}
 */
export async function obtainManifest (manifestUrl, documentUrl) {
  const manifestResponse = await fetch(manifestUrl)
  const manifest = await manifestResponse.json()

  // Parse the start URL with the manifest URL as a base
  // If it does not exist, set it to the document URL
  if (manifest.start_url) {
    manifest.start_url = new URL(manifest.start_url, documentUrl)
    manifest.start_url = manifest.start_url.href
  } else {
    manifest.start_url = documentUrl
  }

  // Parse the scope with the manifest URL as a base
  // If it does not exist, set it to the `.` with the start URL as a base
  if (manifest.scope) {
    manifest.scope = new URL(manifest.scope, documentUrl)
    manifest.scope = manifest.scope.href
  } else {
    manifest.scope = new URL('.', manifest.start_url)
    manifest.scope = manifest.scope.href
  }

  // Check if the start URL is the same origin as document URL and is within the scope
  const _startUrl = new URL(manifest.start_url)
  const _scopeUrl = new URL(manifest.scope)
  const _documentUrl = new URL(documentUrl)

  if (_startUrl.origin !== _documentUrl.origin) throw new Error('Start and document URL are not in the same origin')
  if (_startUrl.origin !== _scopeUrl.origin || !_startUrl.pathname.startsWith(_scopeUrl.pathname)) throw new Error('Start URL is not within the scope')

  // Return the validated and parsed manifest
  return manifest
}

/**
 * Obtains the site list from the native program.
 *
 * @returns {Promise<Object[]>}
 */
export async function obtainSiteList () {
  const response = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'GetSiteList' })

  // Handle native connection errors
  if (response.type === 'Error') throw new Error(response.data)
  if (response.type !== 'SiteList') throw new Error(`Received invalid response type: ${response.type}`)

  // Return the site list
  return response.data
}

/**
 * Obtains the profile list from the native program.
 *
 * @returns {Promise<Object[]>}
 */
export async function obtainProfileList () {
  const response = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'GetProfileList' })

  // Handle native connection errors
  if (response.type === 'Error') throw new Error(response.data)
  if (response.type !== 'ProfileList') throw new Error(`Received invalid response type: ${response.type}`)

  // Return the site list
  return response.data
}

/**
 * Gets the configuration of the native program.
 *
 * @returns {Promise<Map>}
 */
export async function getConfig () {
  const response = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'GetConfig' })

  // Handle native connection errors
  if (response.type === 'Error') throw new Error(response.data)
  if (response.type !== 'Config') throw new Error(`Received invalid response type: ${response.type}`)

  // Return the config
  return response.data
}

/**
 * Sets the configuration of the native program.
 *
 * @returns {Promise<void>}
 */
export async function setConfig (config) {
  const response = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'SetConfig', params: config })

  // Handle native connection errors
  if (response.type === 'Error') throw new Error(response.data)
  if (response.type !== 'ConfigSet') throw new Error(`Received invalid response type: ${response.type}`)
}

/**
 * Checks if the native program is installed and updated correctly.
 *
 * * If `ok` is returned, everything is ok
 * * If `install` is returned, native program or the runtime is not installed, and install page should be opened.
 * * If `update-required` is returned, native program is outdated oe incompatible, and update page should be opened.
 * * If `update-optional` is returned, extension is outdated but compatible, and there should just be warning with a link to update page.
 *
 * @returns {Promise<"ok"|"install"|"update-required"|"update-optional">}
 */
export async function checkNativeStatus () {
  try {
    const response = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'GetSystemVersions' })

    if (response.type === 'Error') throw new Error(response.data)
    if (response.type !== 'SystemVersions') throw new Error(`Received invalid response type: ${response.type}`)

    const versionExtension = browser.runtime.getManifest().version
    const versionNative = response.data.firefoxpwa

    // Runtime always needs to be installed, we cannot disable that
    if (!response.data.firefox) return 'install'

    // We can disable update/version checks with a "secret" local storage option
    const UPDATES_CHECK_DISABLED = 'updates.native-version-check-disabled'
    if ((await browser.storage.local.get(UPDATES_CHECK_DISABLED))[UPDATES_CHECK_DISABLED] === true) return 'ok'

    // Similar checks as in `setup/update.js`
    if (semverGt(versionExtension, versionNative)) return 'update-required'
    if (semverGt(versionNative, versionExtension)) {
      if (semverSatisfies(versionNative, `^${versionExtension}`)) return 'update-optional'
      else return 'update-required'
    }
  } catch (error) {
    if (error.message === 'Attempt to postMessage on disconnected port') return 'install'
    throw error
  }

  return 'ok'
}

/**
 * Checks if the runtime can be automatically installed on this platform.
 *
 * Supported platforms:
 * - Windows: All (x86, x64, ARM64)
 * - MacOS: All (x64, ARM64)
 * - Linux: x86, x64
 *
 * @returns {Promise<boolean>}
 */
export async function isAutoRuntimeInstallSupported () {
  const { os, arch } = await browser.runtime.getPlatformInfo()
  return os === 'win' || os === 'mac' || (os === 'linux' && (arch === 'x86-64' || arch === 'x86-32'))
}

/**
 * Checks if the protocol scheme is permitted.
 *
 * See:
 * * https://developer.mozilla.org/en-US/docs/Web/API/Navigator/registerProtocolHandler#permitted_schemes
 * * https://html.spec.whatwg.org/multipage/system-state.html#normalize-protocol-handler-parameters
 *
 * @returns {boolean}
 */
export function isProtocolSchemePermitted (scheme) {
  const safelistedSchemes = [
    'bitcoin',
    'ftp',
    'ftps',
    'geo',
    'im',
    'irc',
    'ircs',
    'magnet',
    'mailto',
    'matrix',
    'mms',
    'news',
    'nntp',
    'openpgp4fpr',
    'sftp',
    'sip',
    'sms',
    'smsto',
    'ssh',
    'tel',
    'urn',
    'webcal',
    'wtai',
    'xmpp'
  ]

  // The scheme must be converted to ASCII lowercase
  scheme = scheme.toLowerCase()

  // The scheme can be one of the safelisted schemes
  if (safelistedSchemes.includes(scheme)) return true

  // Otherwise, the scheme must start with `web+`
  if (!scheme.startsWith('web+')) return false

  // And it must be followed by one or more ASCII lower alphas
  if (scheme.length <= 4) return false
  for (const char of scheme.substring(4)) {
    if (char < 'a' || char > 'z') return false
  }

  return true
}

/**
 * Launches the site in a PWA browser.
 *
 * @param {{ulid: string}} site
 * @param {string} [url]
 *
 * @returns {Promise<void>}
 */
export async function launchSite (site, url) {
  const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
    cmd: 'LaunchSite',
    params: { id: site.ulid, url }
  })

  if (response.type === 'Error') throw new Error(response.data)
  if (response.type !== 'SiteLaunched') throw new Error(`Received invalid response type: ${response.type}`)

  window.close()
}

/**
 * Gets the sorted list of appropriate site icons.
 *
 * @param {{sizes: string, purpose: string}[]} icons
 * @param {"any"|"maskable"|"monochrome"|} purpose
 *
 * @returns {Object[]}
 */
export function buildIconList (icons, purpose = 'any') {
  const iconList = []

  for (const icon of icons) {
    if (!icon.purpose.split().includes(purpose)) continue

    for (const sizeSpec of icon.sizes.split()) {
      const size = sizeSpec === 'any' ? Number.MAX_SAFE_INTEGER : parseInt(sizeSpec)
      iconList.push({ icon, size })
    }
  }

  iconList.sort((a, b) => (a.size > b.size) ? 1 : -1)
  return iconList
}

/**
 * Gets the smallest icon that is larger than the provided size.
 * If it does not exist, gets the largest icon overall.
 *
 * @param {{size: number, icon: {src: string}}[]} icons
 * @param {number} size
 *
 * @returns {string|null}
 */
export function getIcon (icons, size) {
  if (icons.length === 0) return null

  let icon = icons.find(icon => icon.size >= size)
  if (!icon) icon = icons[icons.length - 1]

  return icon.icon.src
}

/**
 * Sets the popup size to fit into the popup menu if needed.
 */
export async function setPopupSize () {
  const nextFrames = async n => {
    for (let i = 0; i < n; i++) {
      await new Promise(resolve => { self.requestAnimationFrame(() => { resolve() }) })
    }
  }

  await nextFrames(4)

  if (window.innerWidth < document.body.offsetWidth) {
    document.documentElement.style.minWidth = 'initial'
    document.body.style.minWidth = 'initial'
  }
}
