import '../errors'

import {
  launchSite,
  obtainSiteList,
  obtainUrls,
  PREF_LAUNCH_CURRENT_URL,
  setPopupSize
} from '../utils'

async function createInstanceList () {
  // Obtain a current manifest URL
  const { manifestUrl, documentUrl } = await obtainUrls()

  // Obtain a list of existing sites and restrict them to the current manifest URL
  const sites = Object.values(await obtainSiteList())
    .filter(site => site.config.manifest_url === manifestUrl)

  // Get the list element
  const listElement = document.getElementById('instances-list')
  listElement.innerText = ''

  // Launch site with the current URL, if enabled in settings
  let settingsLaunchCurrentUrl = (await browser.storage.local.get(PREF_LAUNCH_CURRENT_URL))[PREF_LAUNCH_CURRENT_URL]
  settingsLaunchCurrentUrl = settingsLaunchCurrentUrl !== undefined ? settingsLaunchCurrentUrl : true

  // Create a list element for every instance with handler that launches it
  for (const site of sites) {
    const url = settingsLaunchCurrentUrl ? documentUrl : undefined

    const siteElement = document.createElement('button')
    siteElement.classList.add(...['list-group-item', 'list-group-item-action'])
    siteElement.innerText = site.config.name || site.manifest.name || site.manifest.short_name || new URL(site.manifest.scope).host
    siteElement.addEventListener('click', () => { launchSite(site, url) })

    listElement.append(siteElement)
  }

  // Create a list element that opens new instance popup
  {
    const newInstanceElement = document.createElement('button')
    newInstanceElement.classList.add(...['list-group-item', 'list-group-item-action'])
    newInstanceElement.innerHTML = '<em>Install a new instance</em>'

    newInstanceElement.addEventListener('click', async () => {
      document.location = '/sites/install.html'
    })

    listElement.append(newInstanceElement)
  }
}

setPopupSize()
createInstanceList()
