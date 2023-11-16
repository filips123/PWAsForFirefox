import '../errors'

import Modal from 'bootstrap/js/src/modal'
import Offcanvas from 'bootstrap/js/src/offcanvas'
import Tab from 'bootstrap/js/src/tab'
import Toast from 'bootstrap/js/src/toast'
import Tags from 'bootstrap5-tags/tags'

import {
  AUTO_LAUNCH_PERMISSIONS,
  buildIconList,
  checkNativeStatus,
  getConfig,
  getIcon,
  isAutoRuntimeInstallSupported,
  isProtocolSchemePermitted,
  launchSite,
  obtainProfileList,
  obtainSiteList,
  PREF_AUTO_LAUNCH_EXCLUSION,
  PREF_DEFAULT_PROFILE_TEMPLATE,
  PREF_DISPLAY_PAGE_ACTION,
  PREF_ENABLE_AUTO_LAUNCH,
  PREF_LAUNCH_CURRENT_URL,
  PREF_SHOW_UPDATE_POPUP,
  setConfig,
  setPopupSize
} from '../utils'
import { knownCategories } from './categories'

// Display install/update page when clicked on browser action and the native program is not correctly installed
async function handleNativeStatus () {
  switch (await checkNativeStatus()) {
    case 'install':
      await browser.tabs.create({ url: browser.runtime.getURL('setup/install.html') })
      window.close()
      break
    case 'update-major':
      await browser.tabs.create({ url: browser.runtime.getURL('setup/update.html') })
      window.close()
      break
    case 'update-minor': {
      const outdatedBox = document.getElementById('extension-outdated-box')
      document.getElementById('extension-outdated-update').setAttribute('href', browser.runtime.getURL('setup/update.html'))
      document.getElementById('extension-outdated-close').addEventListener('click', () => outdatedBox.classList.add('d-none'))
      outdatedBox.classList.remove('d-none')
    }
      break
  }
}

// Fill the site list
async function createSiteList () {
  const siteInstallButton = document.getElementById('site-install-button')

  // Hide the installation button on sites where it wouldn't work
  const tab = (await browser.tabs.query({ active: true, currentWindow: true }))[0]
  if (!tab.url || !(tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
    siteInstallButton.classList.add('d-none')
  }

  // Handle installing current site
  // Just open site install popup
  siteInstallButton.addEventListener('click', async () => {
    document.location = browser.runtime.getURL('sites/install.html')
  })

  // Obtain a list of sites and profiles
  const sites = Object.values(await obtainSiteList())
  const profiles = await obtainProfileList()

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
    const siteName = site.config.name || site.manifest.name || site.manifest.short_name || new URL(site.manifest.scope).host
    const siteIcon = site.config.icon_url || getIcon(buildIconList(site.manifest.icons), 64)

    const letterElement = siteElement.querySelector('#sites-list-template-letter')
    if (siteIcon) letterElement.classList.add('d-none')
    letterElement.setAttribute('data-letter', siteName[0])
    letterElement.removeAttribute('id')

    const iconElement = siteElement.querySelector('#sites-list-template-icon')
    if (!siteIcon) iconElement.classList.add('d-none')
    iconElement.src = siteIcon
    iconElement.removeAttribute('id')
    iconElement.onerror = () => {
      letterElement.classList.remove('d-none')
      iconElement.classList.add('d-none')
    }

    const titleElement = siteElement.querySelector('#sites-list-template-title')
    titleElement.innerText = siteName
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
      document.getElementById('web-app-icon-url').value = site.config.icon_url
      document.getElementById('web-app-ulid').value = site.ulid

      // Clear previous categories
      const categoriesElement = document.getElementById('web-app-categories')
      categoriesElement.tagsInstance.resetSearchInput()
      categoriesElement.tagsInstance.reset()

      // Set categories from config or manifest
      const categoriesList = site.config.categories?.length ? site.config.categories : site.manifest.categories
      for (const category of categoriesList || []) categoriesElement.tagsInstance.addItem(category, category)

      // Clear previous keywords
      const keywordsElement = document.getElementById('web-app-keywords')
      keywordsElement.tagsInstance.resetSearchInput()
      keywordsElement.tagsInstance.reset()

      // Set keywords from config or manifest
      const keywordsList = site.config.keywords?.length ? site.config.keywords : site.manifest.keywords
      for (const keyword of keywordsList || []) keywordsElement.tagsInstance.addItem(keyword, keyword)

      // Set site's profile from config
      const profilesElement = document.getElementById('web-app-profile')
      profilesElement.replaceChildren()
      profilesElement.add(new Option(profiles[site.profile].name || site.profile, site.profile))

      // Create protocol handlers list and set enabled handlers
      // Currently only supported on Windows and Linux (macOS does not work)
      const platform = await browser.runtime.getPlatformInfo()
      if (platform.os === 'win' || platform.os === 'linux') {
        const possibleHandlers = new Set([...site.config.custom_protocol_handlers, ...site.manifest.protocol_handlers].map(handler => handler.protocol).sort())
        const enabledHandlers = site.config.enabled_protocol_handlers

        const handlersBox = document.getElementById('web-app-protocol-handlers-box')
        const handlersList = document.getElementById('web-app-protocol-handlers-list')
        handlersList.replaceChildren()

        for (const handler of possibleHandlers) {
          if (isProtocolSchemePermitted(handler)) {
            const checkboxInput = document.createElement('input')
            checkboxInput.classList.add('web-app-protocol-handler', 'form-check-input', 'me-1')
            checkboxInput.type = 'checkbox'
            checkboxInput.value = handler
            if (enabledHandlers.includes(handler)) checkboxInput.checked = true

            const checkboxLabel = document.createElement('span')
            checkboxLabel.innerText = handler

            const checkboxItemGroup = document.createElement('label')
            checkboxItemGroup.classList.add('list-group-item')
            checkboxItemGroup.append(checkboxInput, checkboxLabel)
            handlersList.append(checkboxItemGroup)
          }
        }

        if (handlersList.children.length) handlersBox.classList.remove('d-none')
        else handlersBox.classList.add('d-none')
      }

      // Hide launch on login preference on macOS
      // Users on macOS can enable launching at login from the OS UI
      if (platform.os === 'mac') document.getElementById('web-app-launch-on-login-box').classList.add('d-none')

      // Set auto launch preference from config
      const autoLaunchGlobal = (await browser.storage.local.get(PREF_ENABLE_AUTO_LAUNCH))[PREF_ENABLE_AUTO_LAUNCH]
      if (autoLaunchGlobal) {
        document.getElementById('web-app-auto-launch').checked = site.config.enabled_url_handlers?.length
        document.getElementById('web-app-auto-launch-box').classList.remove('d-none')
      } else {
        document.getElementById('web-app-auto-launch-box').classList.add('d-none')
      }

      // Set launch on login and browser preferences from config
      document.getElementById('web-app-launch-on-login').checked = site.config.launch_on_login
      document.getElementById('web-app-launch-on-browser').checked = site.config.launch_on_browser

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
          this.setCustomValidity('Name cannot be reused from existing web apps')
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

      // Validate icon URL input
      const iconUrlValidation = function () {
        const invalidLabel = document.getElementById('web-app-icon-url-invalid')

        // Empty URL defaults to manifest icons
        if (!this.value) {
          this.setCustomValidity('')
          return
        }

        // Icon URL needs to be a valid URL
        if (this.validity.typeMismatch) {
          this.setCustomValidity('Icon URL needs to be a valid URL')
          invalidLabel.innerText = this.validationMessage
          return
        }

        // All checks passed
        this.setCustomValidity('')
      }

      const iconUrlInput = document.getElementById('web-app-icon-url')
      iconUrlInput.addEventListener('input', iconUrlValidation)
      iconUrlValidation.call(iconUrlInput)

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
        const iconUrl = document.getElementById('web-app-icon-url').value || null
        const name = document.getElementById('web-app-name').value || null
        const description = document.getElementById('web-app-description').value || null

        // Get categories and keywords based on user form input and site manifest
        // If the user list is identical to the manifest, ignore it, otherwise, set it as a user overwrite
        const userCategories = [...document.getElementById('web-app-categories').selectedOptions].map(option => option.value)
        const manifestCategories = site.manifest.categories || []
        const categories = userCategories.toString() !== manifestCategories.toString() ? userCategories : null

        const userKeywords = [...document.getElementById('web-app-keywords').selectedOptions].map(option => option.value)
        const manifestKeywords = site.manifest.keywords || []
        const keywords = userKeywords.toString() !== manifestKeywords.toString() ? userKeywords : null

        // Get list of enabled protocol handlers
        const enabledProtocolHandlers = [...document.querySelectorAll('.web-app-protocol-handler:checked')].map(check => check.value)

        // Control whether the auto launch is enabled
        const autoLaunchEnabled = document.getElementById('web-app-auto-launch').checked
        const enabledUrlHandlers = []
        if (autoLaunchEnabled) enabledUrlHandlers.push(site.manifest.scope)

        // Tell the native connector to update the site
        const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
          cmd: 'UpdateSite',
          params: {
            id: site.ulid,
            start_url: startUrl,
            icon_url: iconUrl,
            name,
            description,
            categories,
            keywords,
            enabled_url_handlers: enabledUrlHandlers,
            enabled_protocol_handlers: enabledProtocolHandlers,
            launch_on_login: document.getElementById('web-app-launch-on-login').checked,
            launch_on_browser: document.getElementById('web-app-launch-on-browser').checked,
            update_manifest: document.getElementById('web-app-update-manifest').checked,
            update_icons: document.getElementById('web-app-update-icons').checked
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
      }

      // Show offcanvas element
      Offcanvas.getOrCreateInstance(document.getElementById('site-edit-offcanvas')).show()
      event.preventDefault()
    })
    editElement.removeAttribute('id')

    const removeElement = siteElement.querySelector('#sites-list-template-remove')
    removeElement.addEventListener('click', () => {
      const lastSiteInProfile = profiles[site.profile].sites.length <= 1

      document.getElementById('site-remove-button').onclick = async function () {
        this.disabled = true
        this.innerText = 'Removing...'

        const deleteProfileCheckbox = document.getElementById('site-remove-last-checkbox')
        if (lastSiteInProfile && deleteProfileCheckbox.checked) {
          const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
            cmd: 'RemoveProfile',
            params: { id: site.profile }
          })

          if (response.type === 'Error') throw new Error(response.data)
          if (response.type !== 'ProfileRemoved') throw new Error(`Received invalid response type: ${response.type}`)
        } else {
          const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
            cmd: 'UninstallSite',
            params: { id: site.ulid }
          })

          if (response.type === 'Error') throw new Error(response.data)
          if (response.type !== 'SiteUninstalled') throw new Error(`Received invalid response type: ${response.type}`)
        }

        this.disabled = true
        this.innerText = 'Removed!'

        // Close the popup after some time
        setTimeout(async () => {
          window.close()
        }, 5000)
      }

      if (lastSiteInProfile) {
        document.getElementById('site-remove-last').hidden = false
        document.getElementById('site-remove-not-last').hidden = true
      } else {
        document.getElementById('site-remove-last').hidden = true
        document.getElementById('site-remove-not-last').hidden = false
      }

      Modal.getOrCreateInstance(document.getElementById('site-remove-modal')).show()
    })
    removeElement.removeAttribute('id')

    listElement.insertBefore(siteElement, templateElement)
  }
}

// Fill the list of profiles
async function createProfileList () {
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

    // Show profile template box
    const profileTemplate = (await browser.storage.local.get([PREF_DEFAULT_PROFILE_TEMPLATE]))[PREF_DEFAULT_PROFILE_TEMPLATE]
    document.getElementById('profile-template-div').classList.remove('d-none')
    document.getElementById('profile-template').value = profileTemplate || null

    // Hide profile ULID box
    document.getElementById('profile-ulid-div').classList.add('d-none')

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
      const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
        cmd: 'CreateProfile',
        params: {
          name: document.getElementById('profile-name').value || null,
          description: document.getElementById('profile-description').value || null,
          template: document.getElementById('profile-template').value || null
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
    }

    // Show offcanvas element
    Offcanvas.getOrCreateInstance(document.getElementById('profile-edit-offcanvas')).show()
    event.preventDefault()
  })

  // Obtain a list of profiles
  const profiles = Object.values(await obtainProfileList())

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
      document.getElementById('profile-ulid').value = profile.ulid

      // Hide profile template box
      document.getElementById('profile-template-div').classList.add('d-none')

      // Show profile ULID box
      document.getElementById('profile-ulid-div').classList.remove('d-none')

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

        const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
          cmd: 'RemoveProfile',
          params: { id: profile.ulid }
        })

        if (response.type === 'Error') throw new Error(response.data)
        if (response.type !== 'ProfileRemoved') throw new Error(`Received invalid response type: ${response.type}`)

        this.disabled = true
        this.innerText = 'Removed!'

        // Close the popup after some time
        setTimeout(async () => {
          window.close()
        }, 5000)
      }

      const nilUlid = '0'.repeat(26)
      if (profile.ulid === nilUlid) document.getElementById('profile-remove-default').classList.remove('d-none')
      else document.getElementById('profile-remove-default').classList.add('d-none')

      Modal.getOrCreateInstance(document.getElementById('profile-remove-modal')).show()
    })
    removeElement.removeAttribute('id')

    listElement.insertBefore(profileElement, templateElement)
  }
}

// Handle site and profile search
async function handleSearch () {
  const searchHandler = function (listElement) {
    document.getElementById('search-box').classList.remove('invisible')

    document.getElementById('search-input').oninput = function () {
      for (const item of document.getElementById(listElement).children) {
        const itemName = item.querySelector('.list-group-item-name')?.innerText.toLowerCase()
        const searchQuery = this.value.toLowerCase()

        if (!itemName) continue
        item.classList.toggle('d-none', itemName.indexOf(searchQuery) === -1)
      }
    }
  }

  const searchHide = function () {
    document.getElementById('search-box').classList.add('invisible')
  }

  document.getElementById('sites-tab').addEventListener('click', () => searchHandler('sites-list'))
  document.getElementById('profiles-tab').addEventListener('click', () => searchHandler('profiles-list'))
  document.getElementById('settings-tab').addEventListener('click', () => searchHide())

  searchHandler('sites-list')
}

// Handle extension settings
async function handleSettings (hasChanged = false) {
  // Get settings from local storage and media query
  const settings = await browser.storage.local.get([PREF_DISPLAY_PAGE_ACTION, PREF_LAUNCH_CURRENT_URL, PREF_SHOW_UPDATE_POPUP, PREF_ENABLE_AUTO_LAUNCH, PREF_DEFAULT_PROFILE_TEMPLATE, PREF_AUTO_LAUNCH_EXCLUSION])
  const settingsDisplayPageAction = settings[PREF_DISPLAY_PAGE_ACTION] ? settings[PREF_DISPLAY_PAGE_ACTION] : 'valid'
  const settingsLaunchCurrentUrl = settings[PREF_LAUNCH_CURRENT_URL] !== undefined ? settings[PREF_LAUNCH_CURRENT_URL] : true
  const settingsShowUpdatePopup = settings[PREF_SHOW_UPDATE_POPUP] !== undefined ? settings[PREF_SHOW_UPDATE_POPUP] : true
  const settingsEnableAutoLaunch = settings[PREF_ENABLE_AUTO_LAUNCH] !== undefined ? settings[PREF_ENABLE_AUTO_LAUNCH] : false
  const settingsEnableDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  const settingsDefaultProfileTemplate = settings[PREF_DEFAULT_PROFILE_TEMPLATE] || null
  const settingsAutoLaunchExclusion = settings[PREF_AUTO_LAUNCH_EXCLUSION] || null

  // Set settings input values
  document.getElementById('settings-display-page-action').querySelector(`#settings-display-page-action-${settingsDisplayPageAction}`).checked = true
  document.getElementById('settings-launch-current-url').checked = settingsLaunchCurrentUrl
  document.getElementById('settings-show-update-popup').checked = settingsShowUpdatePopup
  document.getElementById('settings-enable-auto-launch').checked = settingsEnableAutoLaunch
  document.getElementById('settings-enable-dark-mode').checked = settingsEnableDarkMode
  document.getElementById('settings-default-profile-template').value = settingsDefaultProfileTemplate
  document.getElementById('settings-auto-launch-exclusion').value = settingsAutoLaunchExclusion

  // Do not re-register listeners
  if (hasChanged) return

  // Listen for display page action input changes
  document.getElementById('settings-display-page-action').addEventListener('change', async function () {
    await browser.storage.local.set({ [PREF_DISPLAY_PAGE_ACTION]: this.querySelector(':checked').value })
  })

  // Listen for launch current URL input changes
  document.getElementById('settings-launch-current-url').addEventListener('change', async function () {
    await browser.storage.local.set({ [PREF_LAUNCH_CURRENT_URL]: this.checked })
  })

  // Listen for show updates popup input changes
  document.getElementById('settings-show-update-popup').addEventListener('change', async function () {
    await browser.storage.local.set({ [PREF_SHOW_UPDATE_POPUP]: this.checked })
  })

  // Listen for enabled auto launch input changes
  const enableAutoLaunchSwitch = document.getElementById('settings-enable-auto-launch')
  const enableAutoLaunchModal = document.getElementById('enable-auto-launch-modal')
  const enableAutoLaunchConfirm = document.getElementById('enable-auto-launch-confirm')

  enableAutoLaunchModal.addEventListener('hide.bs.modal', async function () {
    // Reset the switch in case user closed the modal without confirming
    if (!(await browser.storage.local.get(PREF_ENABLE_AUTO_LAUNCH))[PREF_ENABLE_AUTO_LAUNCH]) {
      enableAutoLaunchSwitch.checked = false
    }
  })

  enableAutoLaunchConfirm.onclick = async function () {
    // Request the required permissions
    const granted = await browser.permissions.request(AUTO_LAUNCH_PERMISSIONS)
    if (!granted) return

    // If permissions are already permitted, just switch the preference
    await browser.storage.local.set({ [PREF_ENABLE_AUTO_LAUNCH]: true })
    Modal.getOrCreateInstance(enableAutoLaunchModal).hide()
  }

  enableAutoLaunchSwitch.addEventListener('change', async function () {
    // Show the modal when enabling the preference
    if (this.checked) Modal.getOrCreateInstance(enableAutoLaunchModal).show()

    // Otherwise store the disabled preference
    else await browser.storage.local.set({ [PREF_ENABLE_AUTO_LAUNCH]: false })
  })

  // Listen for dark mode changes
  window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => handleSettings(true))

  // Listen for default profile template input changes
  document.getElementById('settings-default-profile-template').addEventListener('change', async function () {
    await browser.storage.local.set({ [PREF_DEFAULT_PROFILE_TEMPLATE]: this.value || null })
  })

  // Listen for auto launch exclusion input changes
  document.getElementById('settings-auto-launch-exclusion').addEventListener('change', async function () {
    await browser.storage.local.set({ [PREF_AUTO_LAUNCH_EXCLUSION]: this.value || null })
  })

  // Handle updating all sites
  document.getElementById('update-all-sites-button').onclick = async function () {
    this.disabled = true
    this.innerText = 'Updating...'

    const manifestUpdatesCheckbox = document.getElementById('update-all-sites-manifests')
    const manifestUpdatesEnabled = manifestUpdatesCheckbox.checked
    manifestUpdatesCheckbox.disabled = true

    const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
      cmd: 'UpdateAllSites',
      params: { update_manifest: manifestUpdatesEnabled, update_icons: true }
    })

    if (response.type === 'Error') throw new Error(response.data)
    if (response.type !== 'AllSitesUpdated') throw new Error(`Received invalid response type: ${response.type}`)

    this.disabled = true
    this.innerText = 'Updated!'
  }

  document.getElementById('update-all-sites').onclick = function () {
    const confirmButton = document.getElementById('update-all-sites-button')
    confirmButton.disabled = false
    confirmButton.innerText = 'Update'

    Modal.getOrCreateInstance(document.getElementById('update-all-sites-modal')).show()
  }

  // Handle patching all profiles
  document.getElementById('patch-all-profiles-button').onclick = async function () {
    this.disabled = true
    this.innerText = 'Patching...'

    const patchRuntimeCheckbox = document.getElementById('patch-all-profiles-runtime')
    const patchRuntimeEnabled = patchRuntimeCheckbox.checked
    patchRuntimeCheckbox.disabled = true

    const patchProfilesCheckbox = document.getElementById('patch-all-profiles-profiles')
    const patchProfilesEnabled = patchProfilesCheckbox.checked
    patchProfilesCheckbox.disabled = true

    const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
      cmd: 'PatchAllProfiles',
      params: { patch_runtime: patchRuntimeEnabled, patch_profiles: patchProfilesEnabled }
    })

    if (response.type === 'Error') throw new Error(response.data)
    if (response.type !== 'AllProfilesPatched') throw new Error(`Received invalid response type: ${response.type}`)

    this.disabled = true
    this.innerText = 'Patched!'
  }

  document.getElementById('patch-all-profiles').onclick = function () {
    const confirmButton = document.getElementById('patch-all-profiles-button')
    confirmButton.disabled = false
    confirmButton.innerText = 'Patch'

    Modal.getOrCreateInstance(document.getElementById('patch-all-profiles-modal')).show()
  }

  // Handle runtime reinstallation
  document.getElementById('reinstall-runtime-button').onclick = async function () {
    this.disabled = true
    this.innerText = 'Reinstalling...'

    const responseUninstall = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'UninstallRuntime' })
    if (responseUninstall.type === 'Error') throw new Error(responseUninstall.data)
    if (responseUninstall.type !== 'RuntimeUninstalled') throw new Error(`Received invalid response type: ${responseUninstall.type}`)

    const responseInstall = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'InstallRuntime' })
    if (responseInstall.type === 'Error') throw new Error(responseInstall.data)
    if (responseInstall.type !== 'RuntimeInstalled') throw new Error(`Received invalid response type: ${responseInstall.type}`)

    this.disabled = true
    this.innerText = 'Reinstalled!'
  }

  document.getElementById('reinstall-runtime').onclick = function () {
    const confirmButton = document.getElementById('reinstall-runtime-button')
    confirmButton.disabled = false
    confirmButton.innerText = 'Reinstall'

    Modal.getOrCreateInstance(document.getElementById('reinstall-runtime-modal')).show()
  }

  // Handle showing project information
  document.getElementById('about-project').onclick = async function () {
    const response = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'GetSystemVersions' })
    if (response.type === 'Error') throw new Error(response.data)
    if (response.type !== 'SystemVersions') throw new Error(`Received invalid response type: ${response.type}`)

    const versionExtension = browser.runtime.getManifest().version
    const versionNative = response.data.firefoxpwa
    const versionRuntime = response.data.firefox
    const versionFirefox = (await browser.runtime.getBrowserInfo()).version

    document.getElementById('about-extension-version').innerText = versionExtension
    document.getElementById('about-native-version').innerText = versionNative
    document.getElementById('about-runtime-version').innerText = versionRuntime
    document.getElementById('about-firefox-version').innerText = versionFirefox

    Modal.getOrCreateInstance(document.getElementById('about-project-modal')).show()
  }

  // Lazily load native settings and handle them
  setTimeout(async () => {
    const platform = await browser.runtime.getPlatformInfo()

    // Show Linux-only settings on Linux
    if (platform.os === 'linux') {
      document.getElementById('settings-enable-wayland-container').classList.remove('d-none')
      document.getElementById('settings-use-xinput2-container').classList.remove('d-none')
      document.getElementById('settings-use-portals-container').classList.remove('d-none')
    }

    // Hide patching setting on macOS
    if (platform.os === 'mac') {
      document.getElementById('settings-always-patch-container').classList.add('d-none')
    }

    // Obtain the config from the native program
    const config = await getConfig()

    // Set settings values
    document.getElementById('settings-enable-wayland').checked = config.runtime_enable_wayland
    document.getElementById('settings-use-xinput2').checked = config.runtime_use_xinput2
    document.getElementById('settings-use-portals').checked = config.runtime_use_portals
    document.getElementById('settings-always-patch').checked = config.always_patch

    // Enable settings inputs
    document.getElementById('settings-enable-wayland-container').title = ''
    document.getElementById('settings-use-xinput2-container').title = ''
    document.getElementById('settings-use-portals-container').title = ''
    document.getElementById('settings-always-patch-container').title = ''
    document.getElementById('settings-enable-wayland').disabled = false
    document.getElementById('settings-use-xinput2').disabled = false
    document.getElementById('settings-use-portals').disabled = false
    document.getElementById('settings-always-patch').disabled = false

    // Helper function to update config
    // Listen for enable Wayland changes
    document.getElementById('settings-enable-wayland').addEventListener('change', async function () {
      config.runtime_enable_wayland = this.checked
      await setConfig(config)
    })

    // Listen for use XInput2 changes
    document.getElementById('settings-use-xinput2').addEventListener('change', async function () {
      config.runtime_use_xinput2 = this.checked
      await setConfig(config)
    })

    // Listen for use XDG Portals changes
    document.getElementById('settings-use-portals').addEventListener('change', async function () {
      config.runtime_use_portals = this.checked
      await setConfig(config)
    })

    // Listen for patching changes
    document.getElementById('settings-always-patch').addEventListener('change', async function () {
      config.always_patch = this.checked
      await setConfig(config)
    })
  })

  // Hide runtime reinstallation button on unsupported platforms
  if (!await isAutoRuntimeInstallSupported()) {
    document.getElementById('reinstall-runtime').classList.add('d-none')
  }
}

// Switch to install/update page if needed
handleNativeStatus()

{
  // Provide suggestions for know categories
  const categoriesElement = document.getElementById('web-app-categories')
  for (const knownCategory of knownCategories) categoriesElement.add(new Option(knownCategory, knownCategory))
}

// Prepare the popup
for (const element of document.querySelectorAll('.form-select-tags')) { element.tagsInstance = new Tags(element) }
Tab.getOrCreateInstance(document.getElementById('card-navigation'))
setPopupSize()
createSiteList()
createProfileList()
handleSearch()
handleSettings()
