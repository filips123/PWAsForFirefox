// Obtain the URL of the current page manifest
const manifestElement = document.querySelector('link[rel=manifest]')
let manifestUrl

if (manifestElement) {
  manifestUrl = new URL(manifestElement.getAttribute('href'), window.location)
  manifestUrl = manifestUrl.href
}

// Send the manifest URL and the document URL to the background script on the page load
if (manifestUrl) {
  browser.runtime.sendMessage({ manifest: manifestUrl, document: document.location.href })
}

// Send the manifest and the document URL to the sender of the request message
browser.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message !== 'ObtainUrls') return
  sendResponse({ manifest: manifestUrl, document: document.location.href })
})
