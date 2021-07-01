import { Toast } from 'bootstrap'

import { obtainSiteList, obtainUrls } from '../utils'

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

  // Gets the list element
  const listElement = document.getElementById('instances-list')

  // Create a list element for every instance with handler that launches it
  for (const site of sites) {
    const siteElement = document.createElement('button')
    siteElement.classList.add(...['list-group-item', 'list-group-item-action'])
    siteElement.innerText = site.config.name || site.manifest.name || site.manifest.short_name || new URL(site.manifest.scope).host

    siteElement.addEventListener('click', async () => {
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
    })

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

createInstanceList()
