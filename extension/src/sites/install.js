import { Toast } from 'bootstrap'
import Tags from 'bootstrap5-tags/tags'

async function obtainUrls () {
  const tab = (await browser.tabs.query({ active: true, currentWindow: true }))[0]

  // Ask the content script to obtain the manifest and the document URL
  return await browser.tabs.sendMessage(tab.id, 'ObtainUrls')
}

async function obtainManifest (manifestUrl, documentUrl) {
  const manifestResponse = await fetch(manifestUrl)
  const manifest = await manifestResponse.json()

  // Parse the start URL with the manifest URL as a base
  // If it does not exist, set it to the document URL
  if (manifest.start_url) {
    manifest.start_url = new URL(manifest.start_url, documentUrl)
    manifest.start_url = manifest.start_url.href
  } else {
    manifest.start_url = documentUrl
  }

  // Parse the scope with the manifest URL as a base
  // If it does not exist, set it to the `.` with the start URL as a base
  if (manifest.scope) {
    manifest.scope = new URL(manifest.scope, documentUrl)
    manifest.scope = manifest.scope.href
  } else {
    manifest.scope = new URL('.', manifest.start_url)
    manifest.scope = manifest.scope.href
  }

  // Check if the start URL is the same origin as document URL and is within the scope
  const _startUrl = new URL(manifest.start_url)
  const _scopeUrl = new URL(manifest.scope)
  const _documentUrl = new URL(documentUrl)

  if (_startUrl.origin !== _documentUrl.origin) throw new Error('Start and document URL are not in the same origin')
  if (_startUrl.origin !== _scopeUrl.origin || !_startUrl.pathname.startsWith(_scopeUrl.pathname)) throw new Error('Start URL is not within the scope')

  // Return the validated and parsed manifest
  return manifest
}

async function initializeForm () {
  const form = document.getElementById('web-app-form')
  const submit = document.getElementById('web-app-submit')

  // Create tags input
  for (const element of document.querySelectorAll('.form-select-tags')) {
    element.tagsInstance = new Tags(element)
  }

  // Obtain manifest for the current site
  const { manifest: manifestUrl, document: documentUrl } = await obtainUrls()
  const manifest = await obtainManifest(manifestUrl, documentUrl)

  // Determine web app name from the manifest name, short name or scope host
  let name = manifest.name
  if (!name) name = manifest.short_name
  if (!name) name = new URL(manifest.scope).host

  // Determine web app description from the manifest description or fallback to an empty string
  const description = manifest.description || ''

  // Set web app data to inputs
  document.getElementById('web-app-name').setAttribute('placeholder', name)
  document.getElementById('web-app-description').setAttribute('placeholder', description)
  document.getElementById('web-app-start-url').setAttribute('placeholder', manifest.start_url)

  const categoriesElement = document.getElementById('web-app-categories')
  for (const category of manifest.categories || []) categoriesElement.tagsInstance.addItem(category, category)

  const keywordsElement = document.getElementById('web-app-keywords')
  for (const keyword of manifest.keywords || []) keywordsElement.tagsInstance.addItem(keyword, keyword)

  // TODO: Support to choose existing profile or create a new one

  // Set form to be validated after all inputs are filled with default values and enable submit button
  form.classList.add('was-validated')
  submit.disabled = false
  submit.innerText = 'Install web app'

  // Validate the name input
  document.getElementById('web-app-name').addEventListener('input', function () {
    // const invalidLabel = document.getElementById('web-app-name-invalid')
    // TODO: Check if any existing web app already has the same name and alert the user
  })

  // Validate start URL input
  document.getElementById('web-app-start-url').addEventListener('input', function () {
    const invalidLabel = document.getElementById('web-app-start-url-invalid')

    // Empty URL defaults to manifest start URL
    if (!this.value) {
      this.setCustomValidity('')
      return
    }

    // Start URL needs to be a valid URL
    if (this.validity.typeMismatch) {
      this.setCustomValidity('Start URL needs to be a valid URL')
      invalidLabel.innerText = this.validationMessage
      return
    }

    // Start URL needs to be within the scope
    const startUrl = new URL(this.value)
    const scope = new URL(manifest.scope)
    if (startUrl.origin !== scope.origin || !startUrl.pathname.startsWith(scope.pathname)) {
      this.setCustomValidity(`Start URL needs to be within the scope: ${scope}`)
      invalidLabel.innerText = this.validationMessage
      return
    }

    // All checks passed
    this.setCustomValidity('')
  })

  // Handle form submission and validation
  submit.onclick = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    // Validate the form using built-in browser validation
    if (!form.checkValidity()) return

    // Change button to progress
    submit.disabled = true
    submit.innerText = 'Installing web app...'

    // Get simple site data
    const startUrl = document.getElementById('web-app-start-url').value || null
    const profile = document.getElementById('web-app-profile').value || null
    const name = document.getElementById('web-app-name').value || null
    const description = document.getElementById('web-app-description').value || null

    // Get categories and keywords based on user form input and site manifest
    // If the user list is identical to the manifest, ignore it, otherwise, set it as a user overwrite
    const userCategories = [...document.getElementById('web-app-categories').selectedOptions].map(option => option.value)
    const manifestCategories = manifest.categories
    const categories = userCategories.toString() !== manifestCategories.toString() ? userCategories : []

    const userKeywords = [...document.getElementById('web-app-keywords').selectedOptions].map(option => option.value)
    const manifestKeywords = manifest.keywords
    const keywords = userKeywords.toString() !== manifestKeywords.toString() ? userKeywords : []

    // Tell the native connector to install the site
    try {
      const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
        cmd: 'InstallSite',
        params: {
          manifest_url: manifestUrl,
          document_url: documentUrl,
          start_url: startUrl,
          profile: profile,
          name: name,
          description: description,
          categories,
          keywords
        }
      })

      // Handle native connection errors
      if (response.type === 'Error') throw new Error(response.data)
      if (response.type !== 'SiteInstalled') throw new Error(`Received invalid response type: ${response.type}`)

      // Hide error toast
      Toast.getOrCreateInstance(document.getElementById('error-toast')).hide()

      // Change button to success
      submit.disabled = true
      submit.innerText = 'Web app installed!'
    } catch (error) {
      console.error(error)

      document.getElementById('error-text').innerText = error.message
      Toast.getOrCreateInstance(document.getElementById('error-toast')).show()
    }
  }
}

initializeForm()
