import { iframeResize } from 'iframe-resizer'

import { isAutoRuntimeInstallSupported } from '../utils'

const iframeResizer = iframeResize({}, '#connector-instructions')[0].iFrameResizer

/*****************************
 License Agreement
 *****************************/

const STORAGE_LICENSE_ACCEPTED = 'storage.license-agreement-accepted'

async function checkLicenseAgreement () {
  document.getElementById('license-agreement').classList.add('active')

  if ((await browser.storage.local.get(STORAGE_LICENSE_ACCEPTED))[STORAGE_LICENSE_ACCEPTED] === true) {
    document.getElementById('license-agreement-view').classList.add('d-none')
    await checkNativeConnection()
  } else {
    document.getElementById('license-agreement-view').classList.remove('d-none')
  }
}

document.getElementById('license-agreement-accept').onclick = async function () {
  await browser.storage.local.set({ [STORAGE_LICENSE_ACCEPTED]: true })
  await checkLicenseAgreement()
}

/*****************************
 Connector Installation
 ****************************/

async function checkNativeConnection () {
  document.getElementById('connector-installation').classList.add('active')

  try {
    /**
     * Response from the native program.
     * @typedef {Object} NativeResponse
     *
     * @property {NativeResponseType} type - Response type
     * @property {NativeResponseData} data - Response data
     */

    /**
     * @typedef {"Error"|"SystemVersions"|"RuntimeInstalled"|"RuntimeUninstalled"} NativeResponseType
     * @typedef {Object} NativeResponseData
     */

    /**
     * @type NativeResponse
     */
    // Get system versions from the connector
    const response = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'GetSystemVersions' })
    if (response.type === 'Error') throw new Error(response.data)
    if (response.type !== 'SystemVersions') throw new Error(`Received invalid response type: ${response.type}`)

    // Get both extension and native versions
    const versionExtension = browser.runtime.getManifest().version
    const versionNative = response.data.firefoxpwa

    // Check if versions are compatible (have the same major component)
    if (versionExtension.split('.', 1)[0] === versionNative.split('.', 1)[0]) {
      document.getElementById('connector-installation-view').classList.add('d-none')
      await checkRuntimeInstallation(response.data)
    } else {
      document.getElementById('connector-native-error').classList.add('d-none')
      document.getElementById('connector-version-error').classList.remove('d-none')
      document.getElementById('connector-version-error-extension').innerText = versionExtension
      document.getElementById('connector-version-error-native').innerText = versionNative

      document.getElementById('connector-installation-view').classList.remove('d-none')
      iframeResizer.resize()
    }
  } catch (error) {
    if (error.message !== 'Attempt to postMessage on disconnected port') {
      document.getElementById('connector-version-error').classList.add('d-none')
      document.getElementById('connector-native-error').classList.remove('d-none')
      document.getElementById('connector-native-error-text').innerText = error.message
      console.error(error)
    }

    document.getElementById('connector-installation-view').classList.remove('d-none')
    iframeResizer.resize()
  }

  setTimeout(checkNativeConnection, 10000)
}

/*****************************
 Runtime Installation
 ****************************/

async function checkRuntimeInstallation (versions) {
  document.getElementById('runtime-installation').classList.add('active')

  if (!versions.firefox) {
    // Show the runtime installation view
    document.getElementById('runtime-installation-view').classList.remove('d-none')

    // Show the 7-Zip installation info if needed
    if (!versions._7zip && (await browser.runtime.getPlatformInfo()).os === 'win') {
      document.getElementById('runtime-needs-7zip').classList.remove('d-none')
    } else {
      document.getElementById('runtime-needs-7zip').classList.add('d-none')
    }

    // Show the manual installation info if needed
    if (!await isAutoRuntimeInstallSupported()) {
      document.getElementById('runtime-manual-install').classList.remove('d-none')
      document.getElementById('runtime-auto-install').classList.add('d-none')
      document.getElementById('runtime-install-start').classList.add('d-none')
    }
  } else {
    // Hide the runtime installation view
    document.getElementById('runtime-installation-view').classList.add('d-none')

    // Show the ready view
    document.getElementById('ready').classList.add('active')
    document.getElementById('ready-view').classList.remove('d-none')
  }
}

document.getElementById('runtime-install-start').onclick = async function () {
  this.innerText = 'Installing the runtime...'
  this.disabled = true

  try {
    // Start the runtime installation
    const response = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'InstallRuntime' })

    // Handle native connection errors
    if (response.type === 'Error') throw new Error(response.data)
    if (response.type !== 'RuntimeInstalled') throw new Error(`Received invalid response type: ${response.type}`)

    this.innerText = 'Runtime installed!'
  } catch (error) {
    console.error(error)

    document.getElementById('runtime-install-error').classList.remove('d-none')
    document.getElementById('runtime-install-error-text').innerText = error.message
  }
}

/*****************************
 Start The Wizard
 ****************************/

async function startWizard () {
  await iframeResizer.resize()
  await checkLicenseAgreement()
}

startWizard()
