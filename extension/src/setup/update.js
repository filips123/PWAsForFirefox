import '../utils/i18nHtml'

import { iframeResize } from 'iframe-resizer'
import semverCompare from 'semver/functions/compare'

async function checkVersions () {
  try {
    iframeResizer.resize()

    /**
     * @type NativeResponse
     */
    // Get system versions from the connector
    const response = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'GetSystemVersions' })
    if (response.type === 'Error') throw new Error(response.data)
    if (response.type !== 'SystemVersions') throw new Error(`Received invalid response type: ${response.type}`)

    // Hide the error div
    document.getElementById('native-error').classList.add('d-none')

    // Get extension and native versions
    const versionExtension = browser.runtime.getManifest().version
    const versionNative = response.data.firefoxpwa

    // Display both versions
    document.getElementById('version-extension').innerText = versionExtension
    document.getElementById('version-native').innerText = versionNative

    // Compare them and check if they are compatible
    const compared = semverCompare(versionExtension, versionNative)
    const compatible = versionExtension.split('.', 1)[0] === versionNative.split('.', 1)[0]

    // Native is outdated
    if (compared > 0) {
      if (compatible) {
        document.getElementById('native-versions-compatible').classList.remove('d-none')
        document.getElementById('native-versions-incompatible').classList.add('d-none')
        document.getElementById('release-notes-incompatible').classList.add('d-none')
      } else {
        document.getElementById('native-versions-compatible').classList.add('d-none')
        document.getElementById('native-versions-incompatible').classList.remove('d-none')
        document.getElementById('release-notes-incompatible').classList.remove('d-none')
      }
      document.getElementById('native-not-updated').classList.remove('d-none')
      document.getElementById('connector-instructions').classList.remove('d-none')
      iframeResizer.resize()
    } else {
      document.getElementById('native-not-updated').classList.add('d-none')
    }

    // Extension is outdated
    if (compared < 0) {
      if (compatible) {
        document.getElementById('extension-versions-compatible').classList.remove('d-none')
        document.getElementById('extension-versions-incompatible').classList.add('d-none')
        document.getElementById('release-notes-incompatible').classList.add('d-none')
      } else {
        document.getElementById('extension-versions-compatible').classList.add('d-none')
        document.getElementById('extension-versions-incompatible').classList.remove('d-none')
        document.getElementById('release-notes-incompatible').classList.remove('d-none')
      }
      document.getElementById('extension-not-updated').classList.remove('d-none')
    } else {
      document.getElementById('extension-not-updated').classList.add('d-none')
    }

    // Both versions are the same
    if (compared === 0) {
      document.getElementById('both-updated').classList.remove('d-none')
      document.getElementById('release-notes-show').classList.add('d-none')
      return
    } else {
      document.getElementById('both-updated').classList.add('d-none')
      document.getElementById('release-notes-show').classList.remove('d-none')
    }
  } catch (error) {
    if (!['Attempt to postMessage on disconnected port', 'No such native application firefoxpwa'].includes(error.message)) {
      document.getElementById('native-error').classList.remove('d-none')
      document.getElementById('native-error-text').innerText = error.message
      console.error(error)
    }
  }

  setTimeout(checkVersions, 10000)
}

const iframeResizer = iframeResize({}, '#connector-instructions')[0].iFrameResizer
checkVersions()
