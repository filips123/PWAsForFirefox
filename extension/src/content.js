const isAppleMaskIcon = link => link.getAttribute('rel').toLowerCase().includes('mask-icon')

function getIconType (link) {
  const type = link.getAttribute('type')
  if (type) return type.includes('/') ? type : `image/${type}`
  else return isAppleMaskIcon(link) ? 'image/svg+xml' : null
}

function getIconPurpose (link) {
  return isAppleMaskIcon(link) ? 'monochrome' : 'any'
}

// Obtain the initial web app manifest URL
const manifestElement = document.querySelector('link[rel=manifest]')
const manifestUrl = manifestElement ? new URL(manifestElement.getAttribute('href'), document.baseURI) : null

// Send the secure context state, initial manifest and document URLs on the page load
browser.runtime.sendMessage({ manifestUrl: manifestUrl?.href, documentUrl: document.location.href, isSecureContext })

// Send the current manifest and document URLs on request
browser.runtime.onMessage.addListener((message, _, sendResponse) => {
  // Ignore invalid messages
  if (message !== 'ObtainUrls') return

  // Collect the current web app manifest URL
  const manifestElement = document.querySelector('link[rel=manifest]')
  const manifestUrl = manifestElement ? new URL(manifestElement.getAttribute('href'), document.baseURI) : null

  // Collect page info that can be used if the manifest does not exist
  const pageInfo = {
    name: document.querySelector('meta[name=application-name]')?.content || document.title,
    description: document.querySelector('meta[name=description]')?.content,
    icons: [...document.getElementsByTagName('link')]
      .filter(link => link.getAttribute('rel')?.toLowerCase().includes('icon'))
      .map(link => ({
        src: new URL(link.getAttribute('href'), document.baseURI).href,
        type: getIconType(link),
        purpose: getIconPurpose(link),
        sizes: link.getAttribute('sizes') || ''
      }))
  }

  // Send a response with the URLs and page info
  sendResponse({ manifestUrl: manifestUrl?.href, documentUrl: document.location.href, pageInfo })
})
