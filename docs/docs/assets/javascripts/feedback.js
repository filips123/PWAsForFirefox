function sendFeedback (endpoint, page, value) {
  fetch(endpoint, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      'page': page,
      'value': value
    })
  }).catch(() => {})
}

document.addEventListener('DOMContentLoaded', function () {
  // Check if analytics are enabled and get the endpoint
  if (!document.getElementById('__analytics')) return
  const endpoint = JSON.parse(document.getElementById('__analytics').innerText).feedback

  document$.subscribe(function () {
    // Check if the feedback form is displayed
    const feedback = document.forms.feedback
    if (!feedback) return

    feedback.addEventListener('submit', function (event) {
      event.preventDefault()

      // Retrieve page and feedback value
      const page = document.location.pathname
      const value = parseInt(event.submitter.getAttribute('data-md-value'))

      // Send the feedback value to the server
      sendFeedback(endpoint, page, value)

      // Disable form and show note
      feedback.firstElementChild.disabled = true
      const note = feedback.querySelector(`.md-feedback__note [data-md-value='${value}']`)
      if (note) note.hidden = false
    })

    // Show the feedback widget
    feedback.hidden = false
  })
})
