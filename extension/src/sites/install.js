import '../errors'

import { fromByteArray } from 'base64-js'
import Modal from 'bootstrap/js/src/modal'
import Toast from 'bootstrap/js/src/toast'
import Tags from 'bootstrap5-tags/tags'

import { obtainManifest, obtainProfileList, obtainSiteList, obtainUrls, setPopupSize } from '../utils'

async function initializeForm () {
  const form = document.getElementById('web-app-form')
  const submit = document.getElementById('web-app-submit')

  // Create tags input
  for (const element of document.querySelectorAll('.form-select-tags')) {
    element.tagsInstance = new Tags(element)
  }

  // Display profile warning on Linux and macOS
  const platform = await browser.runtime.getPlatformInfo()
  if (platform.os === 'linux' || platform.os === 'mac') {
    const issueLink = document.getElementById('web-app-profile-warn-issue')
    switch (platform.os) {
      case 'linux':
        issueLink.href = 'https://github.com/filips123/PWAsForFirefox/issues/80'
        issueLink.innerText = '#80'
        break
      case 'mac':
        issueLink.href = 'https://github.com/filips123/PWAsForFirefox/issues/81'
        issueLink.innerText = '#81'
    }

    document.getElementById('web-app-profile-warn-box').classList.remove('d-none')
  }

  // Obtain manifest and document URLs for the current site
  let manifestUrl, documentUrl, pageInfo
  try {
    ({ manifestUrl, documentUrl, pageInfo } = await obtainUrls())
  } catch (error) {
    console.error(error)

    // Generate a nice error message
    const errorMessage = document.getElementById('error-text')
    errorMessage.innerHTML = '<p>Failed to access the content script.</p>'

    // Sometimes live-reloading can break content script because of CSP
    if (process.env.NODE_ENV === 'development') {
      errorMessage.innerHTML += '<p>You are using a development build, so this is probably caused by a live-reloading feature.' +
        ' The error may be fixed by disabling it or building in release mode.</p>'
    }

    // Get the current URL for checking for restricted domains
    const tab = (await browser.tabs.query({ active: true, currentWindow: true }))[0]

    // Some Mozilla domains are restricted for security reasons
    if (tab.url && ['firefox.com', 'mozilla.com', 'mozilla.net', 'mozilla.org'].some(domain => tab.url.includes(domain))) {
      errorMessage.innerHTML += '<p>Some <a href="https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts">Mozilla websites</a> are restricted for extensions.' +
        ' This is a Firefox security feature and cannot be disabled.' +
        ' Restricted websites cannot be installed as apps.</p>'
    }

    // Display the error toast
    Toast.getOrCreateInstance(document.getElementById('error-toast')).show()
    return
  }

  // Obtain the manifest for the current site if it exists, otherwise switch to the no manifest mode
  let manifestExists, manifest
  if (manifestUrl) {
    try {
      manifest = await obtainManifest(manifestUrl, documentUrl)
      manifestExists = true
    } catch (error) {
      // Log the error and silently switch to the no manifest mode
      console.log(error)
      manifestExists = false
    }
  } else {
    manifestExists = false
  }

  // Hide use manifest checkbox
  if (!manifestExists) document.getElementById('web-app-use-manifest-box').classList.add('d-none')

  // Obtain a list of existing sites and profiles
  const sites = await obtainSiteList()
  const profiles = await obtainProfileList()

  // Determine web app name and description from manifest or page info
  let name, description
  if (manifestExists) {
    name = manifest.name || manifest.short_name || new URL(manifest.scope).host
    description = manifest.description || ''
  } else {
    name = pageInfo.name || new URL(documentUrl).host
    description = pageInfo.description || ''
  }

  // Set web app data to inputs
  document.getElementById('web-app-name').setAttribute('placeholder', name)
  document.getElementById('web-app-description').setAttribute('placeholder', description)
  document.getElementById('web-app-start-url').setAttribute('placeholder', manifest?.start_url || documentUrl)

  const categoriesElement = document.getElementById('web-app-categories')
  for (const category of manifest?.categories || []) categoriesElement.tagsInstance.addItem(category, category)

  const keywordsElement = document.getElementById('web-app-keywords')
  for (const keyword of manifest?.keywords || []) keywordsElement.tagsInstance.addItem(keyword, keyword)

  // Add available profiles to the select input
  const profilesElement = document.getElementById('web-app-profile')
  for (const profile of Object.values(profiles)) profilesElement.add(new Option(profile.name || profile.ulid, profile.ulid))

  // Add an option to create a new profile to the select input
  profilesElement.add(new Option('Create a new profile', 'create-new-profile'))

  // Handle creating a new profile
  let lastProfileSelection = profilesElement.value
  profilesElement.addEventListener('change', function (event) {
    if (this.value !== 'create-new-profile') {
      lastProfileSelection = this.value
      return
    }

    // Reset previous values
    document.getElementById('new-profile-name').value = ''
    document.getElementById('new-profile-description').value = ''
    const profileButton = document.getElementById('new-profile-create')
    profileButton.disabled = false
    profileButton.innerText = 'Create'

    // Show modal
    Modal.getOrCreateInstance(document.getElementById('new-profile-modal'), { backdrop: 'static', keyboard: false }).show()
    event.preventDefault()
  })

  const newProfileOnCancel = function () { profilesElement.value = lastProfileSelection }
  document.getElementById('new-profile-cancel1').addEventListener('click', newProfileOnCancel)
  document.getElementById('new-profile-cancel2').addEventListener('click', newProfileOnCancel)

  document.getElementById('new-profile-create').addEventListener('click', async function () {
    const name = document.getElementById('new-profile-name').value || null
    const description = document.getElementById('new-profile-description').value || null

    this.disabled = true
    this.innerText = 'Creating...'

    // Create a new profile and get its ID
    const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
      cmd: 'CreateProfile',
      params: { name, description }
    })

    if (response.type === 'Error') throw new Error(response.data)
    if (response.type !== 'ProfileCreated') throw new Error(`Received invalid response type: ${response.type}`)

    // Hide error toast
    Toast.getOrCreateInstance(document.getElementById('error-toast')).hide()

    // Create a new option in the select input and select it
    const id = response.data
    profilesElement.add(new Option(name ?? id, id, true, true), profilesElement.length - 1)
    profilesElement.value = profilesElement.length - 2

    // Hide the modal
    Modal.getOrCreateInstance(document.getElementById('new-profile-modal'), { backdrop: 'static', keyboard: false }).hide()
  })

  // Set form to be validated after all inputs are filled with default values and enable submit button
  form.classList.add('was-validated')
  submit.disabled = false
  submit.innerText = 'Install web app'

  // Validate the name input
  const nameValidation = function () {
    const invalidLabel = document.getElementById('web-app-name-invalid')

    const currentName = this.value || this.getAttribute('placeholder')
    const existingNames = Object.values(sites).map(site => site.config.name || site.manifest.name || site.manifest.short_name || new URL(site.manifest.scope).host)

    // If the name is already used for existing sites, this will cause problems
    if (existingNames.includes(currentName)) {
      this.setCustomValidity('Name cannot reused from existing web apps')
      invalidLabel.innerText = this.validationMessage
      return
    }

    this.setCustomValidity('')
  }

  const nameInput = document.getElementById('web-app-name')
  nameInput.addEventListener('input', nameValidation)
  nameValidation.call(nameInput)

  // Validate start URL input
  const startUrlValidation = function () {
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

    // If the manifest does not exist there is no scope
    if (!manifestExists) {
      this.setCustomValidity('')
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
  }

  const startUrlInput = document.getElementById('web-app-start-url')
  startUrlInput.addEventListener('input', startUrlValidation)
  startUrlValidation.call(startUrlInput)

  // Validate the profile input
  const profileValidation = function () {
    const invalidLabel = document.getElementById('web-app-profile-invalid')

    const existingInstances = Object.values(sites).filter(site => site.config.manifest_url === manifestUrl)
    const existingProfiles = existingInstances.map(site => site.profile)

    // If the profile is already used for another instance of the same site, they won't actually be separate instances
    if (existingProfiles.includes(this.value)) {
      this.setCustomValidity('Only one instance per profile can be installed')
      invalidLabel.innerText = this.validationMessage
      return
    }

    this.setCustomValidity('')
  }

  const profileInput = document.getElementById('web-app-profile')
  profileInput.addEventListener('input', profileValidation)
  profileValidation.call(profileInput)

  // Handle form submission and validation
  submit.onclick = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    // Validate the form using built-in browser validation
    if (!form.checkValidity()) return

    // Change button to progress
    submit.disabled = true
    submit.innerText = 'Installing web app...'

    // Force disable manifest if the checkbox is not checked
    if (!document.getElementById('web-app-use-manifest').checked) manifestExists = false

    // Get simple site data
    const startUrl = document.getElementById('web-app-start-url').value || null
    const profile = document.getElementById('web-app-profile').value || null
    const name = document.getElementById('web-app-name').value || null
    const description = document.getElementById('web-app-description').value || null

    // Get categories and keywords based on user form input and site manifest
    // If the user list is identical to the manifest, ignore it, otherwise, set it as a user overwrite
    const userCategories = [...document.getElementById('web-app-categories').selectedOptions].map(option => option.value)
    const manifestCategories = manifest?.categories || []
    const categories = userCategories.toString() !== manifestCategories.toString() ? userCategories : null

    const userKeywords = [...document.getElementById('web-app-keywords').selectedOptions].map(option => option.value)
    const manifestKeywords = manifest?.keywords || []
    const keywords = userKeywords.toString() !== manifestKeywords.toString() ? userKeywords : null

    // If the manifest does not exist, generate a "fake" manifest data URL
    if (!manifestExists) {
      manifest = {
        start_url: startUrl || documentUrl,
        name: document.getElementById('web-app-name').getAttribute('placeholder') || pageInfo.name,
        description: document.getElementById('web-app-description').getAttribute('placeholder') || pageInfo.description,
        icons: pageInfo.icons
      }

      manifestUrl = 'data:application/manifest+json;base64,'
      manifestUrl += fromByteArray(new TextEncoder().encode(JSON.stringify(manifest)))
    }

    // Tell the native connector to install the site
    const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
      cmd: 'InstallSite',
      params: {
        manifest_url: manifestUrl,
        document_url: documentUrl,
        start_url: startUrl,
        profile,
        name,
        description,
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

    // Update page action
    const tab = (await browser.tabs.query({ active: true, currentWindow: true }))[0]
    await browser.pageAction.setIcon({ tabId: tab.id, path: '/images/page-action-launch.svg' })
    browser.pageAction.setTitle({ tabId: tab.id, title: browser.i18n.getMessage('actionLaunchSite') })
    browser.pageAction.setPopup({ tabId: tab.id, popup: '/sites/launch.html' })

    // Close the popup after some time
    setTimeout(async () => {
      window.close()
    }, 5000)
  }
}

setPopupSize()
initializeForm()
