XPCOMUtils.defineLazyModuleGetters(this, {
  ShortcutUtils: 'resource://gre/modules/ShortcutUtils.jsm',
  hookFunction: 'resource://pwa/utils/hookFunction.jsm',
  xPref: 'resource://pwa/utils/xPref.jsm',
});

class PwaPreferences {
  preferenceElementsAdded = false

  constructor () {
    // Register preference data
    this.addPreferenceData();

    // Register preference localization
    document.l10n.addResourceIds(['pwa/preferences.ftl']);

    // Register preference elements
    try { this.addPreferenceElements() } catch {}
    hookFunction(gMainPane, 'init', null, () => { this.addPreferenceElements(); });

    // Handle switch of preferences on load and when they changes
    setTimeout(() => { this.handleTabsModePreferenceSwitch(true); } );
    xPref.addListener(ChromeLoader.PREF_ENABLE_TABS_MODE, () => { this.handleTabsModePreferenceSwitch() } );
  }

  addPreferenceData () {
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
    ]);
  }

  addPreferenceElements () {
    if (this.preferenceElementsAdded) return;
    this.preferenceElementsAdded = true;

    const firefoxpwaGroup = MozXULElement.parseXULToFragment(`
<groupbox id="firefoxpwaGroup" data-category="paneGeneral">
  <label>
    <html:h2 data-l10n-id="firefoxpwa-group-header"></html:h2>
    <description data-l10n-id="firefoxpwa-group-note"></description>
  </label>

  <vbox id="colorsBox" style="padding-top: 1rem;">
    <checkbox preference="${ChromeLoader.PREF_SITES_SET_THEME_COLOR}" data-l10n-id="sites-set-theme-color" />
    <checkbox preference="${ChromeLoader.PREF_SITES_SET_BACKGROUND_COLOR}" data-l10n-id="sites-set-background-color" />
    <checkbox preference="${ChromeLoader.PREF_DYNAMIC_THEME_COLOR}" data-l10n-id="dynamic-theme-color" />
  </vbox>

  <vbox id="titlebarBox" style="padding-top: 1rem;">
    <checkbox preference="${ChromeLoader.PREF_DYNAMIC_WINDOW_TITLE}" data-l10n-id="dynamic-window-title" />
    <checkbox preference="${ChromeLoader.PREF_DYNAMIC_WINDOW_ICON}" data-l10n-id="dynamic-window-icon" />
    <checkbox preference="${ChromeLoader.PREF_ALWAYS_USE_NATIVE_WINDOW_CONTROLS}" data-l10n-id="native-window-controls" class="pref-csd-only" />
  </vbox>

   <vbox id="uxBox" style="padding-top: 1rem;">
    <checkbox preference="${ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER}" data-l10n-id="open-out-of-scope-in-default-browser" />
    <checkbox preference="${ChromeLoader.PREF_ENABLE_TABS_MODE}" data-l10n-id="enable-tabs-mode" />
  </vbox>

  <vbox id="linksTargetBox" style="padding-top: 1rem;">
    <label>
      <description data-l10n-id="links-target-description"></description>
    </label>
    <vbox>
      <radiogroup id="linksTargetRadioGroup" preference="${ChromeLoader.PREF_LINKS_TARGET}">
        <radio value="1" data-l10n-id="links-target-choice-current-tab" />
        <radio value="2" data-l10n-id="links-target-choice-new-window" />
        <radio value="3" data-l10n-id="links-target-choice-new-tab" />
        <radio value="0" data-l10n-id="links-target-choice-keep" />
      </radiogroup>
    </vbox>
  </vbox>

   <vbox id="launchTypeBox" style="padding-top: 1rem;">
    <label>
      <description data-l10n-id="launch-type-description"></description>
    </label>
    <vbox>
      <radiogroup id="launchTypeRadioGroup" preference="${ChromeLoader.PREF_LAUNCH_TYPE}">
        <radio value="0" id="launchTypeNewWindow" data-l10n-id="launch-type-choice-new-window" />
        <radio value="1" id="launchTypeNewTab" data-l10n-id="launch-type-choice-new-tab" />
        <radio value="2" id="launchTypeReplace" data-l10n-id="launch-type-choice-replace" />
        <radio value="3" id="launchTypeFocus" data-l10n-id="launch-type-choice-focus" />
      </radiogroup>
    </vbox>
  </vbox>

  <vbox id="displayUrlBarBox" style="padding-top: 1rem;">
    <label>
      <description data-l10n-id="display-address-bar-description"></description>
    </label>
    <vbox>
      <radiogroup id="displayUrlBarRadioGroup" preference="${ChromeLoader.PREF_DISPLAY_URL_BAR}">
        <radio value="0" data-l10n-id="display-address-bar-choice-out-of-scope" />
        <radio value="2" data-l10n-id="display-address-bar-choice-always" />
        <radio value="1" data-l10n-id="display-address-bar-choice-never" />
      </radiogroup>
    </vbox>
  </vbox>

  <vbox id="allowedDomainsBox" style="padding-top: 1rem;">
    <label>
      <description data-l10n-id="allowed-domains-description"></description>
    </label>
    <vbox>
      <html:input type="text" preference="${ChromeLoader.PREF_ALLOWED_DOMAINS}" data-l10n-id="allowed-domains-input" />
    </vbox>
  </vbox>
</groupbox>
`).firstChild;

    const shortcutsGroup = MozXULElement.parseXULToFragment(`
<groupbox id="shortcutsGroup" data-category="paneGeneral">
  <label>
    <html:h2 data-l10n-id="shortcuts-group-header"></html:h2>
    <description data-l10n-id="shortcuts-group-note"></description>
  </label>
  <vbox id="shortcutsBox" style="padding-top: 1rem;">
    <checkbox preference="${ChromeLoader.PREF_SHORTCUTS_CLOSE_TAB}" id="shortcutsCloseTab" />
    <checkbox preference="${ChromeLoader.PREF_SHORTCUTS_CLOSE_WINDOW}" id="shortcutsCloseWindow" />
    <checkbox preference="${ChromeLoader.PREF_SHORTCUTS_QUIT_APPLICATION}" id="shortcutsQuitApplication" />
    <checkbox preference="${ChromeLoader.PREF_SHORTCUTS_PRIVATE_BROWSING}" id="shortcutsPrivateBrowsing" />
  </vbox>
</groupbox>
`).firstChild;

    function setShortcutMessage (selector, messageId, shortcutId) {
      const target = shortcutsGroup.querySelector(selector);
      target.setAttribute('data-l10n-id', messageId);

      const shortcutElement = window.browsingContext.topChromeWindow.document.getElementById(shortcutId);
      if (!shortcutElement) return;

      const shortcutText = ShortcutUtils.prettifyShortcut(shortcutElement);
      target.setAttribute('data-l10n-args', JSON.stringify({ shortcut: shortcutText }));
    }

    setShortcutMessage('#shortcutsCloseTab', 'shortcuts-close-tab', 'key_close');
    setShortcutMessage('#shortcutsCloseWindow', 'shortcuts-close-window', 'key_closeWindow');
    setShortcutMessage('#shortcutsQuitApplication', 'shortcuts-quit-application', 'key_quitApplication');
    setShortcutMessage('#shortcutsPrivateBrowsing', 'shortcuts-private-browsing', 'key_privatebrowsing');

    const startupGroup = document.getElementById('startupGroup');
    if (startupGroup.hidden) firefoxpwaGroup.hidden = true;
    if (startupGroup.hidden) shortcutsGroup.hidden = true;
    startupGroup.nextElementSibling.after(firefoxpwaGroup);
    startupGroup.nextElementSibling.nextElementSibling.after(shortcutsGroup);
  }

  handleTabsModePreferenceSwitch (onLoad = false) {
    function setTabsSectionDisabled (disabled) {
      document.querySelectorAll('#mainPrefPane > groupbox:nth-child(11) > *').forEach(elem => elem.disabled = disabled)
      document.querySelector('#launchTypeNewTab').disabled = disabled
    }

    if (xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE)) {
      // If the tabs mode is enabled, enable the tabs section and set the links target to a new tab
      setTabsSectionDisabled(false);
      setTimeout(() => setTabsSectionDisabled(false), 100);
      if (!onLoad && xPref.get(ChromeLoader.PREF_LINKS_TARGET) === 1) xPref.set(ChromeLoader.PREF_LINKS_TARGET, 3);

    } else {
      // If the tabs mode is disabled, disable the tabs section and reset preferences
      setTabsSectionDisabled(true)
      setTimeout(() => setTabsSectionDisabled(true), 100);
      if (!onLoad && xPref.get(ChromeLoader.PREF_LINKS_TARGET) === 3) xPref.clear(ChromeLoader.PREF_LINKS_TARGET);
      if (!onLoad && xPref.get(ChromeLoader.PREF_LAUNCH_TYPE) === 1) xPref.clear(ChromeLoader.PREF_LAUNCH_TYPE);
    }
  }
}

new PwaPreferences();
