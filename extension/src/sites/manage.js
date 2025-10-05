import '../utils/errors'
import '../utils/i18nHtml'

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
  PREF_DEFAULT_TAB,
  PREF_DISPLAY_PAGE_ACTION,
  PREF_ENABLE_AUTO_LAUNCH,
  PREF_LAUNCH_CURRENT_URL,
  PREF_LOCALE,
  PREF_SHOW_UPDATE_POPUP,
  sanitizeString,
  setConfig,
  setPopupSize
} from '../utils'
import { getAllLocales, getCurrentLocale, getMessage } from '../utils/i18n'
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

// Set a default tab based on the setting
async function setDefaultTab () {
  const settingsDefaultTab = (await browser.storage.local.get([PREF_DEFAULT_TAB]))[PREF_DEFAULT_TAB] ?? 'site-grid'

  switch (settingsDefaultTab) {
    case 'site-grid':
      document.getElementById('grid-tab').classList.add('active')
      document.getElementById('grid-pane').classList.add('show', 'active')
      break
    case 'site-list':
      document.getElementById('sites-tab').classList.add('active')
      document.getElementById('sites-pane').classList.add('show', 'active')
      break
    case 'profiles':
      document.getElementById('profiles-tab').classList.add('active')
      document.getElementById('profiles-pane').classList.add('show', 'active')
      break
    case 'settings':
      document.getElementById('settings-tab').classList.add('active')
      document.getElementById('settings-pane').classList.add('show', 'active')
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
  const gridContainer = document.getElementById('grid-list')
  const templateElement = document.getElementById('sites-list-template')
  const gridTemplateElement = document.getElementById('grid-list-template')
  const loadingElement = document.getElementById('sites-list-loading')
  const gridLoadingElement = document.getElementById('grid-list-loading')
  const emptyElement = document.getElementById('sites-list-empty')
  const gridEmptyElement = document.getElementById('grid-list-empty')

  loadingElement.classList.add('d-none')
  gridLoadingElement.classList.add('d-none')

  if (!sites.length) {
    emptyElement.classList.remove('d-none')
    gridEmptyElement.classList.remove('d-none')
  }

  // Create a list element for every instance with handlers for launching and editing
  for (const site of sites) {
    // Create list view item
    const siteElement = templateElement.content.firstElementChild.cloneNode(true)

    // Create grid view item
    const gridItem = gridTemplateElement.content.firstElementChild.cloneNode(true)

    const siteName = sanitizeString(site.config.name || site.manifest.name || site.manifest.short_name) || new URL(site.manifest.scope).host
    const siteDescription = sanitizeString(site.config.description || site.manifest.description) || ''
    const siteIcon = site.config.icon_url || getIcon(buildIconList(site.manifest.icons), 64)

    // Setup list view item
    const letterElement = siteElement.querySelector('#sites-list-template-letter')
    if (siteIcon) letterElement.classList.add('d-none')
    letterElement.setAttribute('data-letter', siteName[0])
    letterElement.removeAttribute('id')

    const iconElement = siteElement.querySelector('#sites-list-template-icon')
    if (!siteIcon) iconElement.classList.add('d-none')
    iconElement.src = siteIcon
    iconElement.setAttribute('alt', await getMessage('managePageAppListIcon'))
    iconElement.removeAttribute('id')
    iconElement.onerror = () => {
      letterElement.classList.remove('d-none')
      iconElement.classList.add('d-none')
    }

    // Setup grid view item
    const gridLetterElement = gridItem.querySelector('#grid-list-template-letter')
    if (siteIcon) gridLetterElement.classList.add('d-none')
    gridLetterElement.setAttribute('data-letter', siteName[0])
    gridLetterElement.removeAttribute('id')

    const gridIconElement = gridItem.querySelector('#grid-list-template-icon')
    if (!siteIcon) gridIconElement.classList.add('d-none')
    gridIconElement.src = siteIcon
    gridIconElement.setAttribute('alt', await getMessage('managePageAppListIcon'))
    gridIconElement.removeAttribute('id')
    gridIconElement.onerror = () => {
      gridLetterElement.classList.remove('d-none')
      gridIconElement.classList.add('d-none')
    }

    // Handle grid item clicks to show/hide buttons
    const buttonsPopup = gridItem.querySelector('.grid-item-buttons')
    gridItem.addEventListener('click', (event) => {
      // Don't show popup if clicking on a button
      if (event.target.closest('.grid-item-buttons')) {
        return
      }

      // Remove active class from all other items
      document.querySelectorAll('.grid-item').forEach(item => {
        if (item !== gridItem) {
          item.classList.remove('active')
        }
      })

      // Toggle active class on clicked item
      gridItem.classList.toggle('active')

      if (gridItem.classList.contains('active')) {
        // Position the popup at click coordinates
        buttonsPopup.style.top = `${event.clientY}px`
        buttonsPopup.style.left = `${event.clientX}px`

        // Adjust position if popup would go off screen
        const rect = buttonsPopup.getBoundingClientRect()
        const viewportWidth = document.documentElement.clientWidth
        const viewportHeight = document.documentElement.clientHeight

        if (rect.right > viewportWidth) {
          buttonsPopup.style.left = `${event.clientX - rect.width}px`
        }
        if (rect.bottom > viewportHeight) {
          buttonsPopup.style.top = `${event.clientY - rect.height}px`
        }
      }

      event.stopPropagation()
    })

    // Close popup when clicking outside
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.grid-item')) {
        document.querySelectorAll('.grid-item').forEach(item => {
          item.classList.remove('active')
        })
      }
    })

    // Set titles and descriptions
    const titleElement = siteElement.querySelector('#sites-list-template-title')
    titleElement.innerText = siteName
    titleElement.removeAttribute('id')

    const descriptionElement = siteElement.querySelector('#sites-list-template-description')
    descriptionElement.innerText = siteDescription
    descriptionElement.removeAttribute('id')

    const gridTitleElement = gridItem.querySelector('#grid-list-template-title')
    gridTitleElement.innerText = siteName
    gridTitleElement.removeAttribute('id')

    // Setup launch buttons
    const launchElement = siteElement.querySelector('#sites-list-template-launch')
    const gridLaunchElement = gridItem.querySelector('#grid-list-template-launch')
    const launchElementTooltip = await getMessage('managePageAppListLaunch')

    launchElement.addEventListener('click', () => { launchSite(site) })
    gridLaunchElement.addEventListener('click', () => { launchSite(site) })

    launchElement.setAttribute('title', launchElementTooltip)
    launchElement.setAttribute('aria-label', launchElementTooltip)
    launchElement.removeAttribute('id')

    gridLaunchElement.setAttribute('title', launchElementTooltip)
    gridLaunchElement.setAttribute('aria-label', launchElementTooltip)
    gridLaunchElement.removeAttribute('id')

    // Setup edit buttons
    const editElement = siteElement.querySelector('#sites-list-template-edit')
    const gridEditElement = gridItem.querySelector('#grid-list-template-edit')
    const editElementTooltip = await getMessage('managePageAppListEdit')

    const editHandler = async (event) => {
      const form = document.getElementById('web-app-form')
      const submit = document.getElementById('web-app-submit')

      // Set placeholders from manifest
      document.getElementById('web-app-name').setAttribute('placeholder', sanitizeString(site.manifest.name || site.manifest.short_name) || new URL(site.manifest.scope).host)
      document.getElementById('web-app-description').setAttribute('placeholder', sanitizeString(site.manifest.description) || '')
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
      let categoriesList = site.config.categories?.length ? site.config.categories : site.manifest.categories
      categoriesList = categoriesList?.map(item => sanitizeString(item)).filter(item => item) || []
      for (const category of categoriesList) categoriesElement.tagsInstance.addItem(category, category)

      // Clear previous keywords
      const keywordsElement = document.getElementById('web-app-keywords')
      keywordsElement.tagsInstance.resetSearchInput()
      keywordsElement.tagsInstance.reset()

      // Set keywords from config or manifest
      let keywordsList = site.config.keywords?.length ? site.config.keywords : site.manifest.keywords
      keywordsList = keywordsList?.map(item => sanitizeString(item)).filter(item => item) || []
      for (const keyword of keywordsList) keywordsElement.tagsInstance.addItem(keyword, keyword)

      // Set site's profile from config
      const profilesElement = document.getElementById('web-app-profile')
      profilesElement.replaceChildren()
      profilesElement.add(new Option(sanitizeString(profiles[site.profile].name) || site.profile, site.profile))

      // Create protocol handlers list and set enabled handlers
      // Currently not supported on macOS
      const platform = await browser.runtime.getPlatformInfo()
      if (platform.os !== 'mac') {
        const possibleHandlers = new Set([...site.config.custom_protocol_handlers, ...site.manifest.protocol_handlers].map(handler => sanitizeString(handler.protocol)).filter(handler => handler).sort())
        const enabledHandlers = site.config.enabled_protocol_handlers.map(handler => sanitizeString(handler)).filter(handler => handler)

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
      submit.innerText = await getMessage('buttonEditDefault')

      // Validate the name input
      const nameValidation = async function () {
        const invalidLabel = document.getElementById('web-app-name-invalid')

        const currentName = this.value || this.getAttribute('placeholder')
        const existingSites = sites.filter(elem => site.ulid !== elem.ulid)
        const existingNames = existingSites.map(site => site.config.name || site.manifest.name || site.manifest.short_name || new URL(site.manifest.scope).host)

        // If the name is already used for existing sites, this will cause problems
        if (existingNames.includes(currentName)) {
          this.setCustomValidity(await getMessage('webAppValidationNameReuse'))
          invalidLabel.innerText = this.validationMessage
          return
        }

        this.setCustomValidity('')
      }

      const nameInput = document.getElementById('web-app-name')
      nameInput.oninput = nameValidation
      nameValidation.call(nameInput)

      // Validate start URL input
      const startUrlValidation = async function () {
        const invalidLabel = document.getElementById('web-app-start-url-invalid')
        const warningLabel = document.getElementById('web-app-start-url-warning')

        // Empty URL defaults to manifest start URL
        if (!this.value) {
          this.setCustomValidity('')
          this.classList.remove('is-warning')
          return
        }

        // Start URL needs to be a valid URL
        if (this.validity.typeMismatch) {
          this.classList.remove('is-warning')
          this.setCustomValidity(await getMessage('webAppValidationStartURLInvalid'))
          invalidLabel.innerText = this.validationMessage
          return
        }

        // Start URL should be within the scope
        const startUrl = new URL(this.value)
        const scope = new URL(site.manifest.scope)
        if (startUrl.origin !== scope.origin || !startUrl.pathname.startsWith(scope.pathname)) {
          this.setCustomValidity('')
          warningLabel.innerText = `${await getMessage('webAppValidationStartURLScope')} ${scope}`
          this.classList.add('is-warning')
          return
        }

        // All checks passed
        this.setCustomValidity('')
        this.classList.remove('is-warning')
      }

      const startUrlInput = document.getElementById('web-app-start-url')
      startUrlInput.oninput = startUrlValidation
      startUrlValidation.call(startUrlInput)

      // Validate icon URL input
      const iconUrlValidation = async function () {
        const invalidLabel = document.getElementById('web-app-icon-url-invalid')

        // Empty URL defaults to manifest icons
        if (!this.value) {
          this.setCustomValidity('')
          return
        }

        // Icon URL needs to be a valid URL
        if (this.validity.typeMismatch) {
          this.setCustomValidity(await getMessage('webAppValidationIconURLInvalid'))
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
        submit.innerText = await getMessage('buttonEditProcessing')

        // Get simple site data
        const startUrl = document.getElementById('web-app-start-url').value || null
        const iconUrl = document.getElementById('web-app-icon-url').value || null
        const name = document.getElementById('web-app-name').value || null
        const description = document.getElementById('web-app-description').value || null

        // Get categories and keywords based on user form input and site manifest
        // If the user list is identical to the manifest, ignore it, otherwise, set it as a user overwrite
        const userCategories = [...document.getElementById('web-app-categories').selectedOptions].map(option => option.value)
        const manifestCategories = site.manifest.categories?.map(item => sanitizeString(item)).filter(item => item) || []
        const categories = userCategories.toString() !== manifestCategories.toString() ? userCategories : null

        const userKeywords = [...document.getElementById('web-app-keywords').selectedOptions].map(option => option.value)
        const manifestKeywords = site.manifest.keywords?.map(item => sanitizeString(item)).filter(item => item) || []
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
        submit.innerText = await getMessage('buttonEditFinished')

        // Close the popup after some time
        setTimeout(async () => {
          window.close()
        }, 5000)
      }

      // Show offcanvas element
      Offcanvas.getOrCreateInstance(document.getElementById('site-edit-offcanvas')).show()
      event.preventDefault()
    }

    editElement.addEventListener('click', editHandler)
    gridEditElement.addEventListener('click', editHandler)

    editElement.setAttribute('title', editElementTooltip)
    editElement.setAttribute('aria-label', editElementTooltip)
    editElement.removeAttribute('id')

    gridEditElement.setAttribute('title', editElementTooltip)
    gridEditElement.setAttribute('aria-label', editElementTooltip)
    gridEditElement.removeAttribute('id')

    // Setup remove buttons
    const removeElement = siteElement.querySelector('#sites-list-template-remove')
    const gridRemoveElement = gridItem.querySelector('#grid-list-template-remove')
    const removeElementTooltip = await getMessage('managePageAppListRemove')

    const removeHandler = () => {
      const lastSiteInProfile = profiles[site.profile].sites.length <= 1

      document.getElementById('site-remove-button').onclick = async function () {
        this.disabled = true
        this.innerText = await getMessage('buttonRemoveProcessing')

        const deleteProfileCheckbox = document.getElementById('site-remove-last-checkbox')
        const deleteProfileEnabled = deleteProfileCheckbox.checked
        deleteProfileCheckbox.disabled = true

        if (lastSiteInProfile && deleteProfileEnabled) {
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
        this.innerText = await getMessage('buttonRemoveProcessing')

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
    }

    removeElement.addEventListener('click', removeHandler)
    gridRemoveElement.addEventListener('click', removeHandler)

    removeElement.setAttribute('title', removeElementTooltip)
    removeElement.setAttribute('aria-label', removeElementTooltip)
    removeElement.removeAttribute('id')

    gridRemoveElement.setAttribute('title', removeElementTooltip)
    gridRemoveElement.setAttribute('aria-label', removeElementTooltip)
    gridRemoveElement.removeAttribute('id')

    listElement.insertBefore(siteElement, templateElement)
    gridContainer.insertBefore(gridItem, gridTemplateElement)
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
    document.getElementById('profile-edit-label').innerText = await getMessage('managePageProfileListCreate')

    // Clear inputs
    document.getElementById('profile-name').value = ''
    document.getElementById('profile-description').value = ''

    // Show profile template box
    const profileTemplate = (await browser.storage.local.get([PREF_DEFAULT_PROFILE_TEMPLATE]))[PREF_DEFAULT_PROFILE_TEMPLATE]
    document.getElementById('profile-template-div').classList.remove('d-none')
    document.getElementById('profile-template').value = profileTemplate || null

    // Hide profile ULID box
    document.getElementById('profile-ulid-div').classList.add('d-none')

    // Hide profile template editing box
    document.getElementById('profile-template-editing-div').classList.add('d-none')
    document.getElementById('profile-template-editing').required = false
    document.getElementById('profile-template-editing').disabled = true

    // Set form to be validated after all inputs are filled with default values and enable submit button
    form.classList.add('was-validated')
    submit.disabled = false
    submit.innerText = await getMessage('buttonCreateDefault')

    // Handle form submission and validation
    submit.onclick = async (event) => {
      event.preventDefault()
      event.stopPropagation()

      // Validate the form using built-in browser validation
      if (!form.checkValidity()) return

      // Change button to progress
      submit.disabled = true
      submit.innerText = await getMessage('buttonCreateProcessing')

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
      submit.innerText = await getMessage('buttonCreateFinished')

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
    nameElement.innerText = sanitizeString(profile.name) || await getMessage('managePageProfileListUnnamed')
    nameElement.removeAttribute('id')

    const countElement = profileElement.querySelector('#profiles-list-template-count')
    countElement.innerText = `(${await getMessage('managePageProfileListCount', undefined, profile.sites.length)})`
    if (profile.sites.length === 0) {
      countElement.classList.add('text-opacity-50')
    }
    countElement.removeAttribute('id')

    const descriptionElement = profileElement.querySelector('#profiles-list-template-description')
    descriptionElement.innerText = sanitizeString(profile.description) || ''
    descriptionElement.removeAttribute('id')

    const editElement = profileElement.querySelector('#profiles-list-template-edit')
    const editElementTooltip = await getMessage('managePageProfileListEdit')
    editElement.addEventListener('click', async (event) => {
      const form = document.getElementById('profile-form')
      const submit = document.getElementById('profile-submit')

      // Set label to edit
      document.getElementById('profile-edit-label').innerText = await getMessage('managePageProfileListEdit')

      // Set values from config
      document.getElementById('profile-name').value = profile.name || ''
      document.getElementById('profile-description').value = profile.description || ''
      document.getElementById('profile-ulid').value = profile.ulid
      document.getElementById('profile-template-editing-apply').checked = false

      // Hide profile template box
      document.getElementById('profile-template-div').classList.add('d-none')

      // Show profile ULID box
      document.getElementById('profile-ulid-div').classList.remove('d-none')

      // Show profile template editing box
      const profileTemplate = (await browser.storage.local.get([PREF_DEFAULT_PROFILE_TEMPLATE]))[PREF_DEFAULT_PROFILE_TEMPLATE]
      document.getElementById('profile-template-editing-div').classList.remove('d-none')
      document.getElementById('profile-template-editing').value = profileTemplate || null

      // Make the template input disabled when applying template is unselected
      // Make the template input required when applying template is selected
      const applyTemplateHandle = function () {
        const templateInput = document.getElementById('profile-template-editing')
        if (this.checked) {
          templateInput.required = true
          templateInput.disabled = false
        } else {
          templateInput.required = false
          templateInput.disabled = true
        }
      }

      const templateApply = document.getElementById('profile-template-editing-apply')
      templateApply.onchange = applyTemplateHandle
      applyTemplateHandle.call(templateApply)

      // Set form to be validated after all inputs are filled with default values and enable submit button
      form.classList.add('was-validated')
      submit.disabled = false
      submit.innerText = await getMessage('buttonEditDefault')

      // Handle form submission and validation
      submit.onclick = async (event) => {
        event.preventDefault()
        event.stopPropagation()

        // Validate the form using built-in browser validation
        if (!form.checkValidity()) return

        // Change button to progress
        submit.disabled = true
        submit.innerText = await getMessage('buttonEditProcessing')

        // Get the template if it is enabled
        const template = templateApply.checked ? document.getElementById('profile-template-editing').value || null : null

        // Tell the native connector to update the profile
        const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
          cmd: 'UpdateProfile',
          params: {
            id: profile.ulid,
            name: document.getElementById('profile-name').value || null,
            description: document.getElementById('profile-description').value || null,
            template
          }
        })

        // Handle native connection errors
        if (response.type === 'Error') throw new Error(response.data)
        if (response.type !== 'ProfileUpdated') throw new Error(`Received invalid response type: ${response.type}`)

        // Hide error toast
        Toast.getOrCreateInstance(document.getElementById('error-toast')).hide()

        // Change button to success
        submit.disabled = true
        submit.innerText = await getMessage('buttonEditFinished')

        // Close the popup after some time
        setTimeout(async () => {
          window.close()
        }, 5000)
      }

      // Show offcanvas element
      Offcanvas.getOrCreateInstance(document.getElementById('profile-edit-offcanvas')).show()
      event.preventDefault()
    })
    editElement.setAttribute('title', editElementTooltip)
    editElement.setAttribute('aria-label', editElementTooltip)
    editElement.removeAttribute('id')

    const removeElement = profileElement.querySelector('#profiles-list-template-remove')
    const removeElementTooltip = await getMessage('managePageProfileListRemove')
    removeElement.addEventListener('click', () => {
      document.getElementById('profile-remove-button').onclick = async function () {
        this.disabled = true
        this.innerText = await getMessage('buttonRemoveProcessing')

        const response = await browser.runtime.sendNativeMessage('firefoxpwa', {
          cmd: 'RemoveProfile',
          params: { id: profile.ulid }
        })

        if (response.type === 'Error') throw new Error(response.data)
        if (response.type !== 'ProfileRemoved') throw new Error(`Received invalid response type: ${response.type}`)

        this.disabled = true
        this.innerText = await getMessage('buttonRemoveFinished')

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
    removeElement.setAttribute('title', removeElementTooltip)
    removeElement.setAttribute('aria-label', removeElementTooltip)
    removeElement.removeAttribute('id')

    listElement.insertBefore(profileElement, templateElement)
  }
}

// Handle site and profile search
async function handleSearch () {
  const searchHandler = function (listElement, gridElement) {
    document.getElementById('search-box').classList.remove('invisible')

    document.getElementById('search-input').oninput = function () {
      const searchQuery = sanitizeString(this.value.toLowerCase())

      for (const item of document.getElementById(listElement).children) {
        const itemName = sanitizeString(item.querySelector('.list-group-item-name')?.innerText.toLowerCase())
        if (!itemName) continue
        item.classList.toggle('d-none', itemName.indexOf(searchQuery) === -1)
      }

      if (gridElement) {
        for (const item of document.getElementById(gridElement).children) {
          const itemName = sanitizeString(item.querySelector('.list-group-item-name')?.innerText.toLowerCase())
          if (!itemName) continue
          item.classList.toggle('d-none', itemName.indexOf(searchQuery) === -1)
        }
      }
    }
  }

  const searchHide = function () {
    document.getElementById('search-box').classList.add('invisible')
  }

  document.getElementById('grid-tab').addEventListener('click', () => searchHandler('grid-list'))
  document.getElementById('sites-tab').addEventListener('click', () => searchHandler('sites-list'))
  document.getElementById('profiles-tab').addEventListener('click', () => searchHandler('profiles-list'))
  document.getElementById('settings-tab').addEventListener('click', () => searchHide())

  searchHandler('grid-list')
}

// Handle extension settings
async function handleSettings (hasChanged = false) {
  // Get settings from local storage and media query
  const settings = await browser.storage.local.get([PREF_DISPLAY_PAGE_ACTION, PREF_LAUNCH_CURRENT_URL, PREF_SHOW_UPDATE_POPUP, PREF_ENABLE_AUTO_LAUNCH, PREF_DEFAULT_PROFILE_TEMPLATE, PREF_AUTO_LAUNCH_EXCLUSION, PREF_DEFAULT_TAB])
  const settingsDisplayPageAction = settings[PREF_DISPLAY_PAGE_ACTION] ? settings[PREF_DISPLAY_PAGE_ACTION] : 'valid'
  const settingsLaunchCurrentUrl = settings[PREF_LAUNCH_CURRENT_URL] !== undefined ? settings[PREF_LAUNCH_CURRENT_URL] : true
  const settingsShowUpdatePopup = settings[PREF_SHOW_UPDATE_POPUP] !== undefined ? settings[PREF_SHOW_UPDATE_POPUP] : true
  const settingsEnableAutoLaunch = settings[PREF_ENABLE_AUTO_LAUNCH] !== undefined ? settings[PREF_ENABLE_AUTO_LAUNCH] : false
  const settingsEnableDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  const settingsDefaultProfileTemplate = settings[PREF_DEFAULT_PROFILE_TEMPLATE] || null
  const settingsAutoLaunchExclusion = settings[PREF_AUTO_LAUNCH_EXCLUSION] || null
  const settingsDefaultTab = settings[PREF_DEFAULT_TAB] ?? 'site-grid'

  // Set settings input values
  document.getElementById('settings-display-page-action').querySelector(`#settings-display-page-action-${settingsDisplayPageAction}`).checked = true
  document.getElementById('settings-launch-current-url').checked = settingsLaunchCurrentUrl
  document.getElementById('settings-show-update-popup').checked = settingsShowUpdatePopup
  document.getElementById('settings-enable-auto-launch').checked = settingsEnableAutoLaunch
  document.getElementById('settings-enable-dark-mode').checked = settingsEnableDarkMode
  document.getElementById('settings-default-profile-template').value = settingsDefaultProfileTemplate
  document.getElementById('settings-auto-launch-exclusion').value = settingsAutoLaunchExclusion
  document.getElementById('settings-default-tab').value = settingsDefaultTab

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

  // Handle default tab selection
  document.getElementById('settings-default-tab').addEventListener('change', async function () {
    await browser.storage.local.set({ [PREF_DEFAULT_TAB]: this.value })
  })

  // Handle language selection
  const languageElement = document.getElementById('settings-language')
  const languageNames = new Intl.DisplayNames(['en'], { type: 'language', languageDisplay: 'standard' })
  const allLocales = getAllLocales().map(code => [languageNames.of(code), code]).sort((a, b) => a[0].localeCompare(b[0], 'en'))
  const currentLocale = await getCurrentLocale()
  for (const [name, code] of allLocales) {
    languageElement.append(new Option(name, code, code === currentLocale, code === currentLocale))
  }
  languageElement.addEventListener('change', async function () {
    await browser.storage.local.set({ [PREF_LOCALE]: this.value })
  })

  // Handle updating all sites
  document.getElementById('update-all-sites-button').onclick = async function () {
    this.disabled = true
    this.innerText = await getMessage('buttonUpdateProcessing')

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
    this.innerText = await getMessage('buttonUpdateFinished')
  }

  document.getElementById('update-all-sites').onclick = async function () {
    const confirmButton = document.getElementById('update-all-sites-button')
    confirmButton.disabled = false
    confirmButton.innerText = await getMessage('buttonUpdateDefault')

    Modal.getOrCreateInstance(document.getElementById('update-all-sites-modal')).show()
  }

  // Handle patching all profiles
  document.getElementById('patch-all-profiles-button').onclick = async function () {
    this.disabled = true
    this.innerText = await getMessage('buttonPatchProcessing')

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
    this.innerText = await getMessage('buttonPatchFinished')
  }

  document.getElementById('patch-all-profiles').onclick = async function () {
    const confirmButton = document.getElementById('patch-all-profiles-button')
    confirmButton.disabled = false
    confirmButton.innerText = await getMessage('buttonPatchDefault')

    Modal.getOrCreateInstance(document.getElementById('patch-all-profiles-modal')).show()
  }

  // Handle runtime reinstallation
  document.getElementById('reinstall-runtime-button').onclick = async function () {
    this.disabled = true
    this.innerText = await getMessage('buttonReinstallProcessing')

    const responseUninstall = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'UninstallRuntime' })
    if (responseUninstall.type === 'Error') throw new Error(responseUninstall.data)
    if (responseUninstall.type !== 'RuntimeUninstalled') throw new Error(`Received invalid response type: ${responseUninstall.type}`)

    const responseInstall = await browser.runtime.sendNativeMessage('firefoxpwa', { cmd: 'InstallRuntime' })
    if (responseInstall.type === 'Error') throw new Error(responseInstall.data)
    if (responseInstall.type !== 'RuntimeInstalled') throw new Error(`Received invalid response type: ${responseInstall.type}`)

    this.disabled = true
    this.innerText = await getMessage('buttonReinstallFinished')
  }

  document.getElementById('reinstall-runtime').onclick = async function () {
    const confirmButton = document.getElementById('reinstall-runtime-button')
    confirmButton.disabled = false
    confirmButton.innerText = await getMessage('buttonReinstallDefault')

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

    // Show Linux-only settings on Linux and BSD
    if (platform.os === 'linux' || platform.os === 'openbsd') {
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
setDefaultTab()
createSiteList()
createProfileList()
handleSearch()
handleSettings()
