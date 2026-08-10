import { SettingGroupManager } from 'chrome://browser/content/preferences/config/SettingGroupManager.mjs'
import { SettingPaneManager } from 'chrome://browser/content/preferences/config/SettingPaneManager.mjs'
import { Preferences } from 'chrome://global/content/preferences/Preferences.mjs'
import { ShortcutUtils } from 'resource://gre/modules/ShortcutUtils.sys.mjs'

import { xPref } from 'resource://pwa/utils/xPref.sys.mjs'

function registerPreferences () {
  Preferences.addAll([
    { id: ChromeLoader.PREF_LINKS_TARGET, type: 'int' },
    { id: ChromeLoader.PREF_LAUNCH_TYPE, type: 'int' },
    { id: ChromeLoader.PREF_DISPLAY_URL_BAR, type: 'int' },
    { id: ChromeLoader.PREF_SITES_SET_THEME_COLOR, type: 'bool' },
    { id: ChromeLoader.PREF_SITES_SET_BACKGROUND_COLOR, type: 'bool' },
    { id: ChromeLoader.PREF_DYNAMIC_THEME_COLOR, type: 'bool' },
    { id: ChromeLoader.PREF_DYNAMIC_WINDOW_TITLE, type: 'bool' },
    { id: ChromeLoader.PREF_DYNAMIC_WINDOW_ICON, type: 'bool' },
    { id: ChromeLoader.PREF_ALWAYS_USE_NATIVE_WINDOW_CONTROLS, type: 'bool' },
    { id: ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER, type: 'bool' },
    { id: ChromeLoader.PREF_ENABLE_TABS_MODE, type: 'bool' },
    { id: ChromeLoader.PREF_ALLOWED_DOMAINS, type: 'wstring' },
    { id: ChromeLoader.PREF_SHORTCUTS_CLOSE_TAB, type: 'bool' },
    { id: ChromeLoader.PREF_SHORTCUTS_CLOSE_WINDOW, type: 'bool' },
    { id: ChromeLoader.PREF_SHORTCUTS_QUIT_APPLICATION, type: 'bool' },
    { id: ChromeLoader.PREF_SHORTCUTS_PRIVATE_BROWSING, type: 'bool' },
  ])
}

function registerLocalization () {
  document.l10n.addResourceIds([{ path: 'pwa/preferences.ftl', optional: true }])
}

function registerAppearanceGroup () {
  // Register subgroups
  Preferences.addSetting({ id: 'group-appearance-titlebar' })
  Preferences.addSetting({ id: 'group-appearance-colors' })

  // Register titlebar preferences
  Preferences.addSetting({ id: 'dynamic-window-title', pref: ChromeLoader.PREF_DYNAMIC_WINDOW_TITLE })
  Preferences.addSetting({ id: 'dynamic-window-icon', pref: ChromeLoader.PREF_DYNAMIC_WINDOW_ICON })
  Preferences.addSetting({ id: 'native-window-controls', pref: ChromeLoader.PREF_ALWAYS_USE_NATIVE_WINDOW_CONTROLS })

  // Register color preferences
  Preferences.addSetting({ id: 'sites-set-theme-color', pref: ChromeLoader.PREF_SITES_SET_THEME_COLOR })
  Preferences.addSetting({ id: 'sites-set-background-color', pref: ChromeLoader.PREF_SITES_SET_BACKGROUND_COLOR })
  Preferences.addSetting({ id: 'dynamic-theme-color', pref: ChromeLoader.PREF_DYNAMIC_THEME_COLOR })

  SettingGroupManager.registerGroup('web-apps-appearance', {
    l10nId: 'group-appearance-header',
    headingLevel: 2,
    items: [
      {
        id: 'group-appearance-titlebar',
        l10nId: 'group-appearance-titlebar-header',
        control: 'moz-fieldset',
        headingLevel: 3,
        items: [
          {
            id: 'dynamic-window-title',
            l10nId: 'dynamic-window-title',
          },
          {
            id: 'dynamic-window-icon',
            l10nId: 'dynamic-window-icon',
          },
          {
            id: 'native-window-controls',
            l10nId: 'native-window-controls',
          },
        ],
      },
      {
        id: 'group-appearance-colors',
        l10nId: 'group-appearance-colors-header',
        control: 'moz-fieldset',
        headingLevel: 3,
        items: [
          {
            id: 'sites-set-theme-color',
            l10nId: 'sites-set-theme-color',
            items: [{
              id: 'dynamic-theme-color',
              l10nId: 'dynamic-theme-color',
            }],
          },
          {
            id: 'sites-set-background-color',
            l10nId: 'sites-set-background-color',
          },
        ],
      },
    ],
  })
}

function registerInterfaceGroup () {
  // Register tabs preferences
  Preferences.addSetting({ id: 'enable-tabs-mode', pref: ChromeLoader.PREF_ENABLE_TABS_MODE })
  Preferences.addSetting({ id: 'manage-tabs-behavior', onUserClick: () => window.gotoPref('paneTabsBrowsing') })

  // Register address bar preferences
  Preferences.addSetting({ id: 'display-address-bar', pref: ChromeLoader.PREF_DISPLAY_URL_BAR })

  SettingGroupManager.registerGroup('web-apps-interface', {
    l10nId: 'group-interface-header',
    headingLevel: 2,
    items: [
      {
        id: 'enable-tabs-mode',
        l10nId: 'enable-tabs-mode',
      },
      {
        id: 'manage-tabs-behavior',
        l10nId: 'manage-tabs-behavior',
        control: 'moz-box-link',
      },
      {
        id: 'display-address-bar',
        l10nId: 'display-address-bar-label',
        control: 'moz-radio-group',
        options: [
          {
            l10nId: 'display-address-bar-choice-out-of-scope',
            value: 0,
          },
          {
            l10nId: 'display-address-bar-choice-always',
            value: 2,
          },
          {
            l10nId: 'display-address-bar-choice-never',
            value: 1,
          },
        ],
      },
    ],
  })
}

function registerBehaviorGroup () {
  // Register subgroups
  Preferences.addSetting({ id: 'group-behavior-out-of-scope' })

  // Launch type and links target preferences depend on the tabs mode, as the "new tab" option is only available when tabs mode is enabled
  // To correctly update this, we need an empty callback here to trigger the update, and the real callback below

  // Register launch type preferences
  Preferences.addSetting({
    id: 'launch-type',
    pref: ChromeLoader.PREF_LAUNCH_TYPE,
    deps: ['enable-tabs-mode'],
    disabled: () => false,
  })

  // Register links target preferences
  Preferences.addSetting({
    id: 'links-target',
    pref: ChromeLoader.PREF_LINKS_TARGET,
    deps: ['enable-tabs-mode'],
    disabled: () => false,
  })

  // Register out-of-scope preferences
  Preferences.addSetting({
    id: 'open-out-of-scope-in-default-browser',
    pref: ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER,
  })
  Preferences.addSetting({
    id: 'allowed-domains',
    pref: ChromeLoader.PREF_ALLOWED_DOMAINS,
  })

  SettingGroupManager.registerGroup('web-apps-behavior', {
    l10nId: 'group-behavior-header',
    headingLevel: 2,
    items: [
      {
        id: 'launch-type',
        l10nId: 'launch-type-label',
        control: 'moz-radio-group',
        deps: ['enable-tabs-mode'],
        options: [
          {
            l10nId: 'launch-type-choice-new-window',
            value: 0,
          },
          {
            l10nId: 'launch-type-choice-new-tab',
            get disabled () { return !xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE) },
            value: 1,
          },
          {
            l10nId: 'launch-type-choice-replace',
            value: 2,
          },
          {
            l10nId: 'launch-type-choice-focus',
            value: 3,
          },
        ],
      },
      {
        id: 'links-target',
        l10nId: 'links-target-label',
        control: 'moz-radio-group',
        options: [
          {
            l10nId: 'links-target-choice-new-window',
            value: 2,
          },
          {
            l10nId: 'links-target-choice-new-tab',
            get disabled () { return !xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE) },
            value: 3,
          },
          {
            l10nId: 'links-target-choice-current-tab',
            value: 1,
          },
          {
            l10nId: 'links-target-choice-keep',
            value: 0,
          },
        ],
      },
      {
        id: 'group-behavior-out-of-scope',
        l10nId: 'group-behavior-out-of-scope-header',
        control: 'moz-fieldset',
        headingLevel: 3,
        items: [
          {
            id: 'open-out-of-scope-in-default-browser',
            l10nId: 'open-out-of-scope-in-default-browser',
            items: [{
              id: 'allowed-domains',
              l10nId: 'allowed-domains',
              control: 'moz-input-text',
            }],
          },
        ],
      },
    ],
  })
}

function registerShortcutsGroup () {
  // Register shortcuts preferences
  Preferences.addSetting({ id: 'shortcuts-close-tab', pref: ChromeLoader.PREF_SHORTCUTS_CLOSE_TAB })
  Preferences.addSetting({ id: 'shortcuts-close-window', pref: ChromeLoader.PREF_SHORTCUTS_CLOSE_WINDOW })
  Preferences.addSetting({ id: 'shortcuts-quit-application', pref: ChromeLoader.PREF_SHORTCUTS_QUIT_APPLICATION })
  Preferences.addSetting({ id: 'shortcuts-private-browsing', pref: ChromeLoader.PREF_SHORTCUTS_PRIVATE_BROWSING })

  const getShortcutText = shortcut => {
    const element = window.browsingContext.topChromeWindow.document.getElementById(shortcut)
    return element ? ShortcutUtils.prettifyShortcut(element) : undefined
  }

  const prepareShortcutSetting = (shortcutId, settingId) => ({
    id: settingId,
    l10nId: settingId,
    l10nArgs: getShortcutText(shortcutId) ? { shortcut: getShortcutText(shortcutId) } : undefined,
  })

  SettingGroupManager.registerGroup('web-apps-shortcuts', {
    l10nId: 'group-shortcuts-header',
    headingLevel: 2,
    items: [
      prepareShortcutSetting('key_close', 'shortcuts-close-tab'),
      prepareShortcutSetting('key_closeWindow', 'shortcuts-close-window'),
      prepareShortcutSetting('key_quitApplication', 'shortcuts-quit-application'),
      prepareShortcutSetting('key_privatebrowsing', 'shortcuts-private-browsing'),
    ],
  })
}

function registerCategory () {
  const categories = document.getElementById('categories')

  const category = document.createElement('moz-page-nav-button')
  category.id = 'category-web-apps'
  category.setAttribute('view', 'paneWebApps')
  category.setAttribute('iconsrc', 'chrome://browser/skin/window.svg')
  category.setAttribute('data-l10n-id', 'pane-web-apps-title')

  categories.insertBefore(category, categories.firstChild)

  SettingPaneManager.registerPane('webApps', {
    iconSrc: 'chrome://browser/skin/window.svg',
    l10nId: 'pane-web-apps-section',
    groupIds: ['web-apps-appearance', 'web-apps-interface', 'web-apps-behavior', 'web-apps-shortcuts'],
  })
}

function handleTabsModePreferenceSwitch (onLoad = false) {
  function disableTabsSection (disabled) {
    // Disable the tabs section
    document.querySelector('setting-group[groupid="tabs"] moz-fieldset')?.toggleAttribute('disabled', disabled)
  }

  if (xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE)) {
    // If the tabs mode is enabled, enable the tabs section and set the links target to a new tab
    disableTabsSection(false)
    if (!onLoad && xPref.get(ChromeLoader.PREF_LINKS_TARGET) === 1) xPref.set(ChromeLoader.PREF_LINKS_TARGET, 3)

  } else {
    // If the tabs mode is disabled, disable the tabs section and reset preferences
    disableTabsSection(true)
    if (!onLoad && xPref.get(ChromeLoader.PREF_LINKS_TARGET) === 3) xPref.clear(ChromeLoader.PREF_LINKS_TARGET)
    if (!onLoad && xPref.get(ChromeLoader.PREF_LAUNCH_TYPE) === 1) xPref.clear(ChromeLoader.PREF_LAUNCH_TYPE)
  }
}

// Register the low-level preferences
registerPreferences()

// Register the localization resources
registerLocalization()

// Register all settings groups and their fields
registerAppearanceGroup()
registerInterfaceGroup()
registerBehaviorGroup()
registerShortcutsGroup()

// Register the web apps category in the sidebar
registerCategory()

// Handle switch of preferences on load and when they changes
setTimeout(() => { handleTabsModePreferenceSwitch(true) })
xPref.addListener(ChromeLoader.PREF_ENABLE_TABS_MODE, () => { handleTabsModePreferenceSwitch() })

document.addEventListener('Initialized', () => {
  // Navigate to the web apps category on direct access
  if (!document.location.hash) window.gotoPref('webApps')
})
