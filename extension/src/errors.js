import Toast from 'bootstrap/js/src/toast'

function displayError (error) {
  document.getElementById('error-text').innerText = error.message
  Toast.getOrCreateInstance(document.getElementById('error-toast')).show()
}

window.addEventListener('error', function (error) {
  displayError(error.error)
  return false
})

window.addEventListener('unhandledrejection', function (error) {
  displayError(error.reason)
  return false
})
