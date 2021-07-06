import { Toast } from 'bootstrap'

import { launchSite, obtainSiteList, obtainUrls, setPopupSize } from '../utils'

async function createInstanceList () {
  // Obtain a current manifest URL
  const { manifest: manifestUrl } = await obtainUrls()

  // Obtain a list of existing sites and restrict them to the current manifest URL
  let sites
  try {
    sites = Object.values(await obtainSiteList())
    sites = sites.filter(site => site.config.manifest_url === manifestUrl)
  } catch (error) {
    console.error(error)
    document.getElementById('error-text').innerText = error.message
    Toast.getOrCreateInstance(document.getElementById('error-toast')).show()
    return
  }

  // Get the list element
  const listElement = document.getElementById('instances-list')
  listElement.innerText = ''

  // Create a list element for every instance with handler that launches it
  for (const site of sites) {
    const siteElement = document.createElement('button')
    siteElement.classList.add(...['list-group-item', 'list-group-item-action'])
    siteElement.innerText = site.config.name || site.manifest.name || site.manifest.short_name || new URL(site.manifest.scope).host
    siteElement.addEventListener('click', () => { launchSite(site) })

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
