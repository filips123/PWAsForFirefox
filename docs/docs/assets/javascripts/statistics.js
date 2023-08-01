function sendView (endpoint, page) {
  fetch(endpoint, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'page': page
    })
  }).catch(() => {})
}

document.addEventListener('DOMContentLoaded', function () {
  // Check if analytics are enabled and get the endpoint
  if (!document.getElementById('__analytics')) return
  const endpoint = JSON.parse(document.getElementById('__analytics').innerText).views

  // Send the initial load view
  sendView(endpoint, document.location.pathname)

  // Send instant loading views
  location$.subscribe((url) => {
    sendView(endpoint, url.pathname)
  })
})
