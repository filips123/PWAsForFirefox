import 'iframe-resizer/js/iframeResizer.contentWindow'

import { Tab } from 'bootstrap'

async function prepareInstallInstructions () {
  const version = browser.runtime.getManifest().version
  const { os, arch } = await browser.runtime.getPlatformInfo()

  // Set CRT download URL based on system arch and extension version
  let crtArch
  if (arch === 'x86-64') crtArch = 'x64'
  else if (arch === 'x86-32') crtArch = 'x86'
  else if (arch === 'arm') crtArch = 'arm64'
  document.getElementById('connector-download-url-crt').setAttribute('href', `https://aka.ms/vs/16/release/vc_redist.${crtArch}.exe`)

  // Set MSI download URL based on system arch and extension version
  // Currently just relying on x86 emulation for Windows ARM
  const msiArch = arch === 'x86-64' ? 'x86_64' : 'x86'
  document.getElementById('connector-download-url-msi').setAttribute('href', `https://github.com/filips123/FirefoxPWA/releases/download/v${version}/firefoxpwa-${version}-${msiArch}.msi`)

  // Set DEB download URL based on system arch and extension version
  // For ARM it doesn't matter which version we set because DEB tab will be hidden later
  const debArch = arch === 'x86-64' ? 'amd64' : 'i386'
  document.getElementById('connector-download-url-deb').setAttribute('href', `https://github.com/filips123/FirefoxPWA/releases/download/v${version}/firefoxpwa_${version}_${debArch}.deb`)

  // Set RPM download URL based on system arch and extension version
  // For ARM it doesn't matter which version we set because RPM tab will be hidden later
  const rpmArch = arch === 'x86-64' ? 'x86_64' : 'i686'
  document.getElementById('connector-download-url-rpm').setAttribute('href', `https://github.com/filips123/FirefoxPWA/releases/download/v${version}/firefoxpwa-${version}-1.${rpmArch}.rpm`)

  // Set repository info based on extension version
  for (const elem of document.getElementsByClassName('connector-repository-tag')) elem.innerText = `v${version}`
  for (const elem of document.getElementsByClassName('connector-project-version')) elem.innerText = version

  // Link to the specific version for the install script
  const branchName = version === '0.0.0' ? 'main' : `v${version}`
  document.getElementById('connector-source-install-linux').setAttribute('href', `https://github.com/filips123/FirefoxPWA/tree/${branchName}/native#other-linux`)
  document.getElementById('connector-source-install-macos').setAttribute('href', `https://github.com/filips123/FirefoxPWA/tree/${branchName}/native#macos`)

  // Hide DEB and RPM tabs on ARM
  // And rename "Other Linux" to just "Linux"
  if (arch === 'arm') {
    document.getElementById('linux-deb-install-tab').classList.add('d-none')
    document.getElementById('linux-rpm-install-tab').classList.add('d-none')
  }

  // Set the default tab to the current OS
  let defaultTab

  if (os === 'win') {
    defaultTab = 'windows'
  } else if (os === 'linux') {
    defaultTab = arch === 'arm' ? 'linux-source' : 'linux-deb'
  } else if (os === 'mac') {
    defaultTab = 'macos'
  } else {
    defaultTab = 'other'
  }

  new Tab(document.getElementById(`${defaultTab}-install-tab`)).show()
}

prepareInstallInstructions()
