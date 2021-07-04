import { iframeResize } from 'iframe-resizer'
import { satisfies as semverSatisfies } from 'semver'

/*****************************
 License Agreement
 *****************************/

const STORAGE_LICENSE_ACCEPTED = 'storage.license-agreement-accepted'

async function checkLicenseAgreement () {
  if ((await browser.storage.local.get(STORAGE_LICENSE_ACCEPTED))[STORAGE_LICENSE_ACCEPTED] === true) {
    const nativeInstalled = await checkNativeConnection()

    document.getElementById('license-agreement').classList.add('active')
    document.getElementById('license-agreement-view').classList.add('d-none')

    if (!nativeInstalled) {
      document.getElementById('connector-installation').classList.add('active')
      document.getElementById('connector-installation-view').classList.remove('d-none')
    }
  } else {
    document.getElementById('license-agreement').classList.add('active')
    document.getElementById('license-agreement-view').classList.remove('d-none')
  }
}

checkLicenseAgreement()

document.getElementById('license-agreement-accept').onclick = async function () {
  await browser.storage.local.set({ [STORAGE_LICENSE_ACCEPTED]: true })
  await checkLicenseAgreement()
}

/*****************************
 Connector Installation
 ****************************/

async function checkNativeConnection () {
  // Store if native connection is working
  let nativeInstalled = false

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
    const response = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'GetSystemVersions' })

    // Handle native connection errors
    if (response.type === 'Error') throw new Error(response.data)
    if (response.type !== 'SystemVersions') throw new Error(`Received invalid response type: ${response.type}`)

    // Check if versions are compatible
    const versionExtension = browser.runtime.getManifest().version
    const versionNative = response.data.firefoxpwa
    if (semverSatisfies(versionNative, `^${versionExtension}`)) {
      document.getElementById('connector-native-error').classList.add('d-none')
      document.getElementById('connector-version-error').classList.add('d-none')

      nativeInstalled = true

      await provideRuntimeInstallInstructions(response.data)
      const runtimeInstalled = await checkRuntimeInstallation(response.data)
      if (runtimeInstalled) return true
    } else {
      document.getElementById('connector-native-error').classList.add('d-none')
      document.getElementById('connector-version-error').classList.remove('d-none')

      document.getElementById('connector-version-error-extension').innerText = versionExtension
      document.getElementById('connector-version-error-native').innerText = versionNative
    }
  } catch (error) {
    console.error(error)
    if (error.message !== 'Attempt to postMessage on disconnected port') {
      document.getElementById('connector-native-error').classList.remove('d-none')
      document.getElementById('connector-native-error-text').innerText = error.message
    }
  }

  setTimeout(checkNativeConnection, 10000)
  return nativeInstalled
}

/*****************************
 Runtime Installation
 ****************************/

iframeResize({}, '#connector-instructions')

async function provideRuntimeInstallInstructions (versions) {
  document.getElementById('connector-installation').classList.add('active')
  document.getElementById('connector-installation-view').classList.add('d-none')

  document.getElementById('runtime-installation').classList.add('active')
  document.getElementById('runtime-installation-view').classList.remove('d-none')

  if (!versions._7zip && (await browser.runtime.getPlatformInfo()).os === 'win') {
    document.getElementById('runtime-needs-7zip').classList.remove('d-none')
  } else {
    document.getElementById('runtime-needs-7zip').classList.add('d-none')
  }
}

async function checkRuntimeInstallation (versions) {
  if (versions.firefox) {
    document.getElementById('runtime-installation').classList.add('active')
    document.getElementById('runtime-installation-view').classList.add('d-none')

    document.getElementById('ready').classList.add('active')
    document.getElementById('ready-view').classList.remove('d-none')

    return true
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
