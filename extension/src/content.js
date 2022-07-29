const isAppleMaskIcon = link => link.getAttribute('rel').toLowerCase().includes('mask-icon')

// Obtain the initial web app manifest URL
const manifestElement = document.querySelector('link[rel=manifest]')
const manifestUrl = manifestElement ? new URL(manifestElement.getAttribute('href'), document.baseURI) : null

// Send the initial manifest and document URLs on the page load
browser.runtime.sendMessage({ manifestUrl: manifestUrl?.href, documentUrl: document.location.href })

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
        type: link.getAttribute('type') || (isAppleMaskIcon(link) ? 'image/svg+xml' : null),
        purpose: isAppleMaskIcon(link) ? 'monochrome' : 'any',
        sizes: link.getAttribute('sizes') || ''
      }))
  }

  // Send a response with the URLs and page info
  sendResponse({ manifestUrl: manifestUrl?.href, documentUrl: document.location.href, pageInfo })
})
