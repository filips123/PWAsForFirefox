// Obtain the URL of the current page manifest
const manifestElement = document.querySelector('link[rel=manifest]')
let manifestUrl

if (manifestElement) {
  manifestUrl = new URL(manifestElement.getAttribute('href'), document.baseURI)
  manifestUrl = manifestUrl.href
}

// Send the manifest URL and the document URL to the background script on the page load
browser.runtime.sendMessage({ manifestUrl, documentUrl: document.location.href })

// Send the manifest and the document URL to the sender of the request message
browser.runtime.onMessage.addListener((message, _, sendResponse) => {
  // Ignore invalid messages
  if (message !== 'ObtainUrls') return

  // Collect page info that can be used if manifest does not exist
  const isAppleMaskIcon = (link) => link.getAttribute('rel').toLowerCase().includes('mask-icon')
  const pageInfo = {
    name: document.title,
    description: document.querySelector('meta[name=description]')?.content,
    icons: [...document.getElementsByTagName('link')]
      .filter(link => link.hasAttribute('rel') && link.getAttribute('rel').toLowerCase().includes('icon'))
      .map(link => ({
        src: new URL(link.getAttribute('href'), document.baseURI).href,
        type: link.getAttribute('type') || (isAppleMaskIcon(link) ? 'image/svg+xml' : null),
        purpose: isAppleMaskIcon(link) ? 'monochrome' : 'any',
        sizes: link.getAttribute('sizes') || ''
      }))
  }

  // Send a response with the URLs and page info
  sendResponse({ manifestUrl, documentUrl: document.location.href, pageInfo })
})
