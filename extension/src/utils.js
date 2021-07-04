import { Toast } from 'bootstrap'
import { gt as semverGt, satisfies as semverSatisfies } from 'semver'

/**
 * Obtains the manifest and the document URLs by asking the content script of current tab.
 *
 * @returns {Promise<{manifest: string, document: string}>}
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

    // Similar checks as in `setup/update.js`
    if (!response.data.firefox) return 'install'
    if (semverGt(versionExtension, versionNative)) return 'update-required'
    if (semverGt(versionNative, versionExtension)) {
      if (semverSatisfies(versionNative, `^${versionExtension}`)) return 'update-optional'
      else return 'update-required'
    }
  } catch (error) {
    if (error.message === 'Attempt to postMessage on disconnected port') return 'install'
    throw error
  }
}

/**
 * Launches the site in a PWA browser.
 *
 * @param {{id: string}} site
 *
 * @returns {Promise<void>}
 */
export async function launchSite (site) {
  try {
    const response = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'LaunchSite', params: site.ulid })

    if (response.type === 'Error') throw new Error(response.data)
    if (response.type !== 'SiteLaunched') throw new Error(`Received invalid response type: ${response.type}`)

    window.close()
  } catch (error) {
    console.error(error)
    document.getElementById('error-text').innerText = error.message
    Toast.getOrCreateInstance(document.getElementById('error-toast')).show()
  }
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
