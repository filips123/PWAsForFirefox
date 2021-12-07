import 'iframe-resizer/js/iframeResizer.contentWindow'

import { Tab } from 'bootstrap'

async function prepareInstallInstructions () {
  const version = browser.runtime.getManifest().version
  const { os, arch } = await browser.runtime.getPlatformInfo()

  // Set CRT download URL based on system arch
  document.getElementById('connector-download-url-crt').setAttribute('href', `https://aka.ms/vs/16/release/vc_redist.${arch === 'x86-32' ? 'x86' : 'x64'}.exe`)

  // Set CRT winget package based on system arch
  document.getElementById('connector-crt-arch').innerText = arch === 'x86-32' ? 'x86' : 'x64'

  // Set MSI download URL based on system arch and extension version
  // Currently just relying on x86 emulation for Windows ARM
  const msiArch = arch === 'x86-64' ? 'x86_64' : 'x86'
  document.getElementById('connector-download-url-msi').setAttribute('href', `https://github.com/filips123/PWAsForFirefox/releases/download/v${version}/firefoxpwa-${version}-${msiArch}.msi`)

  // Set DEB download URL based on system arch and extension version
  const debArch = (() => {
    switch (arch) {
      case 'x86-32':
        return 'i386'
      case 'x86-64':
        return 'amd64'
      case 'arm':
        return 'armhf'
      case 'arm64':
      case 'aarch64':
        return 'arm64'
      default:
        return null
    }
  })()
  document.getElementById('connector-download-url-deb').setAttribute('href', `https://github.com/filips123/PWAsForFirefox/releases/download/v${version}/firefoxpwa_${version}_${debArch}.deb`)

  // Set RPM download URL based on system arch and extension version
  const rpmArch = (() => {
    switch (arch) {
      case 'x86-32':
        return 'i686'
      case 'x86-64':
        return 'x84_64'
      case 'arm':
        return 'armv7hl'
      case 'arm64':
      case 'aarch64':
        return 'aarch64'
      default:
        return null
    }
  })()
  document.getElementById('connector-download-url-rpm').setAttribute('href', `https://github.com/filips123/PWAsForFirefox/releases/download/v${version}/firefoxpwa-${version}-1.${rpmArch}.rpm`)

  // Set repository info based on extension version
  for (const elem of document.getElementsByClassName('connector-repository-tag')) elem.innerText = `v${version}`
  for (const elem of document.getElementsByClassName('connector-project-version')) elem.innerText = version

  // Link to the specific version for the install script
  const branchName = version === '0.0.0' ? 'main' : `v${version}`
  document.getElementById('connector-source-install-linux').setAttribute('href', `https://github.com/filips123/PWAsForFirefox/tree/${branchName}/native#other-linux`)
  document.getElementById('connector-source-install-macos').setAttribute('href', `https://github.com/filips123/PWAsForFirefox/tree/${branchName}/native#macos`)

  // Hide DEB and RPM tabs on unsupported platforms
  if (debArch === null) document.getElementById('linux-deb-install-tab').classList.add('d-none')
  if (rpmArch === null) document.getElementById('linux-rpm-install-tab').classList.add('d-none')

  // Set the default tab to the current OS
  let defaultTab

  if (os === 'win') {
    defaultTab = 'windows'
  } else if (os === 'linux') {
    defaultTab = debArch ? 'linux-deb' : 'linux-source'
  } else if (os === 'mac') {
    defaultTab = 'macos'
  } else {
    defaultTab = 'other'
  }

  new Tab(document.getElementById(`${defaultTab}-install-tab`)).show()
}

prepareInstallInstructions()
