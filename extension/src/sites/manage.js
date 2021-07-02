import { Modal, Offcanvas, Tab, Toast } from 'bootstrap'
import Tags from 'bootstrap5-tags/tags'

import { buildIconList, checkNativeStatus, getIcon, launchSite, obtainProfileList, obtainSiteList } from '../utils'

// Display install/update page when clicked on browser action and the native program is not correctly installed
async function handleNativeStatus () {
  switch (await checkNativeStatus()) {
    case 'install':
      await browser.tabs.create({ url: browser.runtime.getURL('setup/install.html') })
      window.close()
      break
    case 'update':
      await browser.tabs.create({ url: browser.runtime.getURL('setup/update.html') })
      window.close()
      break
  }
}

// Set popup size to fit into the popup menu if needed
async function checkViewport () {
  const nextFrames = async n => {
    for (let i = 0; i < n; i++) {
      await new Promise(resolve => { self.requestAnimationFrame(() => { resolve() }) })
    }
  }

  await nextFrames(4)

  if (window.innerWidth < document.body.offsetWidth) {
    document.documentElement.style.minWidth = 'initial'
    document.body.style.minWidth = 'initial'
  }
}

// Fill the site list
async function createSiteList () {
  // Obtain a list of sites
  let sites
  try {
    sites = Object.values(await obtainSiteList())
  } catch (error) {
    console.error(error)

    document.getElementById('error-text').innerText = error.message
    Toast.getOrCreateInstance(document.getElementById('error-toast')).show()

    return
  }

  // Get the list elements
  const listElement = document.getElementById('sites-list')
  const templateElement = document.getElementById('sites-list-template')
  const loadingElement = document.getElementById('sites-list-loading')
  const emptyElement = document.getElementById('sites-list-empty')

  loadingElement.classList.add('d-none')
  if (!sites.length) emptyElement.classList.remove('d-none')

  // Create a list element for every instance with handlers for launching and editing
  for (const site of sites) {
    const siteElement = templateElement.content.firstElementChild.cloneNode(true)

    const icons = buildIconList(site.manifest.icons)
    const icon = getIcon(icons, 64)

    const iconElement = siteElement.querySelector('#sites-list-template-icon')
    if (!icon) iconElement.classList.add('d-none')
    iconElement.src = icon
    iconElement.removeAttribute('id')

    const titleElement = siteElement.querySelector('#sites-list-template-title')
    titleElement.innerText = site.config.name || site.manifest.name || site.manifest.short_name || new URL(site.manifest.scope).host
    titleElement.removeAttribute('id')

    const descriptionElement = siteElement.querySelector('#sites-list-template-description')
    descriptionElement.innerText = site.config.description || site.manifest.description || ''
    descriptionElement.removeAttribute('id')

    const launchElement = siteElement.querySelector('#sites-list-template-launch')
    launchElement.addEventListener('click', () => { launchSite(site) })
    launchElement.removeAttribute('id')

    const editElement = siteElement.querySelector('#sites-list-template-edit')
    editElement.addEventListener('click', async (event) => {
      const form = document.getElementById('web-app-form')
      const submit = document.getElementById('web-app-submit')

      // Set placeholders from manifest
      document.getElementById('web-app-name').setAttribute('placeholder', site.manifest.name || site.manifest.short_name || new URL(site.manifest.scope).host)
      document.getElementById('web-app-description').setAttribute('placeholder', site.manifest.description || '')
      document.getElementById('web-app-start-url').setAttribute('placeholder', site.manifest.start_url)

      // Set values from config
      document.getElementById('web-app-name').value = site.config.name || ''
      document.getElementById('web-app-description').value = site.config.description || ''
      document.getElementById('web-app-start-url').value = site.config.start_url

      // Set categories from config or manifest
      const categoriesElement = document.getElementById('web-app-categories')
      const categoriesList = site.config.categories.length ? site.config.categories : site.manifest.categories
      while (categoriesElement.tagsInstance.containerElement.querySelectorAll('span').length) categoriesElement.tagsInstance.removeLastItem()
      for (const category of categoriesList || []) categoriesElement.tagsInstance.addItem(category, category)
      categoriesElement.tagsInstance.searchInput.value = ''

      // Set keywords from config or manifest
      const keywordsElement = document.getElementById('web-app-keywords')
      const keywordsList = site.config.keywords.length ? site.config.keywords : site.manifest.keywords
      while (keywordsElement.tagsInstance.containerElement.querySelectorAll('span').length) keywordsElement.tagsInstance.removeLastItem()
      for (const keyword of keywordsList || []) keywordsElement.tagsInstance.addItem(keyword, keyword)
      keywordsElement.tagsInstance.searchInput.value = ''

      // Set form to be validated after all inputs are filled with default values and enable submit button
      form.classList.add('was-validated')
      submit.disabled = false
      submit.innerText = 'Edit'

      // Validate the name input
      const nameValidation = function () {
        const invalidLabel = document.getElementById('web-app-name-invalid')

        const currentName = this.value || this.getAttribute('placeholder')
        const existingSites = sites.filter(elem => site.ulid !== elem.ulid)
        const existingNames = existingSites.map(site => site.config.name || site.manifest.name || site.manifest.short_name || new URL(site.manifest.scope).host)

        // If the name is already used for existing sites, this will cause problems
        if (existingNames.includes(currentName)) {
          this.setCustomValidity('Site name must not be reused from existing web apps')
          invalidLabel.innerText = this.validationMessage
          return
        }

        this.setCustomValidity('')
      }

      const nameInput = document.getElementById('web-app-name')
      nameInput.oninput = nameValidation
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

        // Start URL needs to be within the scope
        const startUrl = new URL(this.value)
        const scope = new URL(site.manifest.scope)
        if (startUrl.origin !== scope.origin || !startUrl.pathname.startsWith(scope.pathname)) {
          this.setCustomValidity(`Start URL needs to be within the scope: ${scope}`)
          invalidLabel.innerText = this.validationMessage
          return
        }

        // All checks passed
        this.setCustomValidity('')
      }

      const startUrlInput = document.getElementById('web-app-start-url')
      startUrlInput.oninput = startUrlValidation
      startUrlValidation.call(startUrlInput)

      // Handle form submission and validation
      submit.onclick = async (event) => {
        event.preventDefault()
        event.stopPropagation()

        // Validate the form using built-in browser validation
        if (!form.checkValidity()) return

        // Change button to progress
        submit.disabled = true
        submit.innerText = 'Editing...'

        // Get simple site data
        const startUrl = document.getElementById('web-app-start-url').value || null
        const name = document.getElementById('web-app-name').value || null
        const description = document.getElementById('web-app-description').value || null

        // Get categories and keywords based on user form input and site manifest
        // If the user list is identical to the manifest, ignore it, otherwise, set it as a user overwrite
        const userCategories = [...document.getElementById('web-app-categories').selectedOptions].map(option => option.value)
        const manifestCategories = site.manifest.categories || []
        const categories = userCategories.toString() !== manifestCategories.toString() ? userCategories : []

        const userKeywords = [...document.getElementById('web-app-keywords').selectedOptions].map(option => option.value)
        const manifestKeywords = site.manifest.keywords || []
        const keywords = userKeywords.toString() !== manifestKeywords.toString() ? userKeywords : []

        // Tell the native connector to update the site
        try {
          const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
            cmd: 'UpdateSite',
            params: {
              id: site.ulid,
              start_url: startUrl,
              name,
              description,
              categories,
              keywords
            }
          })

          // Handle native connection errors
          if (response.type === 'Error') throw new Error(response.data)
          if (response.type !== 'SiteUpdated') throw new Error(`Received invalid response type: ${response.type}`)

          // Hide error toast
          Toast.getOrCreateInstance(document.getElementById('error-toast')).hide()

          // Change button to success
          submit.disabled = true
          submit.innerText = 'Edited!'

          // Close the popup after some time
          setTimeout(async () => {
            window.close()
          }, 5000)
        } catch (error) {
          console.error(error)

          document.getElementById('error-text').innerText = error.message
          Toast.getOrCreateInstance(document.getElementById('error-toast')).show()
        }
      }

      // Show offcanvas element
      Offcanvas.getOrCreateInstance(document.getElementById('site-edit-offcanvas')).show()
      event.preventDefault()
    })
    editElement.removeAttribute('id')

    const removeElement = siteElement.querySelector('#sites-list-template-remove')
    removeElement.addEventListener('click', () => {
      document.getElementById('site-remove-button').onclick = async function () {
        this.disabled = true
        this.innerText = 'Removing...'

        try {
          const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
            cmd: 'UninstallSite',
            params: site.ulid
          })

          if (response.type === 'Error') throw new Error(response.data)
          if (response.type !== 'SiteUninstalled') throw new Error(`Received invalid response type: ${response.type}`)

          this.disabled = true
          this.innerText = 'Removed!'

          // Close the popup after some time
          setTimeout(async () => {
            window.close()
          }, 5000)
        } catch (error) {
          console.error(error)

          document.getElementById('error-text').innerText = error.message
          Toast.getOrCreateInstance(document.getElementById('error-toast')).show()
        }
      }

      Modal.getOrCreateInstance(document.getElementById('site-remove-modal')).show()
    })
    removeElement.removeAttribute('id')

    listElement.append(siteElement)
  }
}

// Fill the list of profiles
async function createProfileList () {
  // Obtain a list of profiles
  let profiles
  try {
    profiles = Object.values(await obtainProfileList())
  } catch (error) {
    console.error(error)

    document.getElementById('error-text').innerText = error.message
    Toast.getOrCreateInstance(document.getElementById('error-toast')).show()

    return
  }

  // Get the list elements
  const listElement = document.getElementById('profiles-list')
  const templateElement = document.getElementById('profiles-list-template')
  const loadingElement = document.getElementById('profiles-list-loading')
  const emptyElement = document.getElementById('profiles-list-empty')

  loadingElement.classList.add('d-none')
  if (!profiles.length) emptyElement.classList.remove('d-none')

  // Create a list element for every instance with handlers for launching and editing
  for (const profile of profiles) {
    const profileElement = templateElement.content.firstElementChild.cloneNode(true)

    const nameElement = profileElement.querySelector('#profiles-list-template-name')
    nameElement.innerText = profile.name || 'Unnamed'
    nameElement.removeAttribute('id')

    const descriptionElement = profileElement.querySelector('#profiles-list-template-description')
    descriptionElement.innerText = profile.description || ''
    descriptionElement.removeAttribute('id')

    const editElement = profileElement.querySelector('#profiles-list-template-edit')
    editElement.addEventListener('click', async (event) => {
      const form = document.getElementById('profile-form')
      const submit = document.getElementById('profile-submit')

      // Set label to edit
      document.getElementById('profile-edit-label').innerText = 'Edit profile'

      // Set values from config
      document.getElementById('profile-name').value = profile.name || ''
      document.getElementById('profile-description').value = profile.description || ''

      // Set form to be validated after all inputs are filled with default values and enable submit button
      form.classList.add('was-validated')
      submit.disabled = false
      submit.innerText = 'Edit'

      // Handle form submission and validation
      submit.onclick = async (event) => {
        event.preventDefault()
        event.stopPropagation()

        // Validate the form using built-in browser validation
        if (!form.checkValidity()) return

        // Change button to progress
        submit.disabled = true
        submit.innerText = 'Editing...'

        // Tell the native connector to update the profile
        try {
          const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
            cmd: 'UpdateProfile',
            params: {
              id: profile.ulid,
              name: document.getElementById('profile-name').value || null,
              description: document.getElementById('profile-description').value || null
            }
          })

          // Handle native connection errors
          if (response.type === 'Error') throw new Error(response.data)
          if (response.type !== 'ProfileUpdated') throw new Error(`Received invalid response type: ${response.type}`)

          // Hide error toast
          Toast.getOrCreateInstance(document.getElementById('error-toast')).hide()

          // Change button to success
          submit.disabled = true
          submit.innerText = 'Edited!'

          // Close the popup after some time
          setTimeout(async () => {
            window.close()
          }, 5000)
        } catch (error) {
          console.error(error)

          document.getElementById('error-text').innerText = error.message
          Toast.getOrCreateInstance(document.getElementById('error-toast')).show()
        }
      }

      // Show offcanvas element
      Offcanvas.getOrCreateInstance(document.getElementById('profile-edit-offcanvas')).show()
      event.preventDefault()
    })
    editElement.removeAttribute('id')

    const removeElement = profileElement.querySelector('#profiles-list-template-remove')
    removeElement.addEventListener('click', () => {
      document.getElementById('profile-remove-button').onclick = async function () {
        this.disabled = true
        this.innerText = 'Removing...'

        try {
          const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
            cmd: 'RemoveProfile',
            params: profile.ulid
          })

          if (response.type === 'Error') throw new Error(response.data)
          if (response.type !== 'ProfileRemoved') throw new Error(`Received invalid response type: ${response.type}`)

          this.disabled = true
          this.innerText = 'Removed!'

          // Close the popup after some time
          setTimeout(async () => {
            window.close()
          }, 5000)
        } catch (error) {
          console.error(error)

          document.getElementById('error-text').innerText = error.message
          Toast.getOrCreateInstance(document.getElementById('error-toast')).show()
        }
      }

      if (profile.default) document.getElementById('profile-remove-default').classList.remove('d-none')
      else document.getElementById('profile-remove-default').classList.add('d-none')

      Modal.getOrCreateInstance(document.getElementById('profile-remove-modal')).show()
    })
    removeElement.removeAttribute('id')

    listElement.insertBefore(profileElement, templateElement)
  }

  // Handle creating new profile
  // Just re-use the same form as for editing, but with different labels and handling
  document.getElementById('profile-create-button').addEventListener('click', async (event) => {
    const form = document.getElementById('profile-form')
    const submit = document.getElementById('profile-submit')

    // Set label to create
    document.getElementById('profile-edit-label').innerText = 'Create profile'

    // Clear inputs
    document.getElementById('profile-name').value = ''
    document.getElementById('profile-description').value = ''

    // Set form to be validated after all inputs are filled with default values and enable submit button
    form.classList.add('was-validated')
    submit.disabled = false
    submit.innerText = 'Create'

    // Handle form submission and validation
    submit.onclick = async (event) => {
      event.preventDefault()
      event.stopPropagation()

      // Validate the form using built-in browser validation
      if (!form.checkValidity()) return

      // Change button to progress
      submit.disabled = true
      submit.innerText = 'Creating...'

      // Tell the native connector to update the profile
      try {
        const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
          cmd: 'CreateProfile',
          params: {
            name: document.getElementById('profile-name').value || null,
            description: document.getElementById('profile-description').value || null
          }
        })

        // Handle native connection errors
        if (response.type === 'Error') throw new Error(response.data)
        if (response.type !== 'ProfileCreated') throw new Error(`Received invalid response type: ${response.type}`)

        // Hide error toast
        Toast.getOrCreateInstance(document.getElementById('error-toast')).hide()

        // Change button to success
        submit.disabled = true
        submit.innerText = 'Created!'

        // Close the popup after some time
        setTimeout(async () => {
          window.close()
        }, 5000)
      } catch (error) {
        console.error(error)

        document.getElementById('error-text').innerText = error.message
        Toast.getOrCreateInstance(document.getElementById('error-toast')).show()
      }
    }

    // Show offcanvas element
    Offcanvas.getOrCreateInstance(document.getElementById('profile-edit-offcanvas')).show()
    event.preventDefault()
  })
}

for (const element of document.querySelectorAll('.form-select-tags')) { element.tagsInstance = new Tags(element) }
Tab.getOrCreateInstance(document.getElementById('card-navigation'))
handleNativeStatus()
checkViewport()
createSiteList()
createProfileList()
