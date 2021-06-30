import { iframeResize } from 'iframe-resizer'
import { eq as semverEq, gt as semverGt, satisfies as semverSatisfies } from 'semver'

async function checkVersions () {
  try {
    const response = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'GetSystemVersions' })

    // Handle native connection errors
    if (response.type === 'Error') throw new Error(response.data)
    if (response.type !== 'SystemVersions') throw new Error(`Received invalid response type: ${response.type}`)

    // Hide error div
    document.getElementById('native-error').classList.add('d-none')

    // Get both versions
    const versionExtension = browser.runtime.getManifest().version
    const versionNative = response.data.firefoxpwa

    // Display them
    document.getElementById('version-extension').innerText = versionExtension
    document.getElementById('version-native').innerText = versionNative

    // Native is outdated
    if (semverGt(versionExtension, versionNative)) {
      document.getElementById('native-not-updated').classList.remove('d-none')
      document.getElementById('connector-instructions').classList.remove('d-none')
    } else {
      document.getElementById('native-not-updated').classList.add('d-none')
      document.getElementById('connector-instructions').classList.add('d-none')
    }

    // Extension is outdated
    if (semverGt(versionNative, versionExtension)) {
      if (semverSatisfies(versionNative, `^${versionExtension}`)) {
        document.getElementById('extension-versions-compatible').classList.remove('d-none')
        document.getElementById('extension-versions-incompatible').classList.add('d-none')
      } else {
        document.getElementById('extension-versions-compatible').classList.add('d-none')
        document.getElementById('extension-versions-incompatible').classList.remove('d-none')
      }
      document.getElementById('extension-not-updated').classList.remove('d-none')
    } else {
      document.getElementById('extension-not-updated').classList.add('d-none')
    }

    // Both are updated
    if (semverEq(versionExtension, versionNative)) {
      document.getElementById('both-updated').classList.remove('d-none')
      return
    } else {
      document.getElementById('both-updated').classList.add('d-none')
    }
  } catch (error) {
    console.error(error)
    if (error.message !== 'Attempt to postMessage on disconnected port') {
      document.getElementById('native-error').classList.remove('d-none')
      document.getElementById('native-error-text').innerText = error.message
    }
  }

  setTimeout(checkVersions, 10000)
}

iframeResize({}, '#connector-instructions')
checkVersions()
