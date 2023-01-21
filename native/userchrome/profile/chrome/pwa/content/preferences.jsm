XPCOMUtils.defineLazyModuleGetters(this, {
  hookFunction: 'resource://pwa/utils/hookFunction.jsm',
  xPref: 'resource://pwa/utils/xPref.jsm',
});

class PwaPreferences {
  constructor () {
    this.addPreferenceData();
    hookFunction(gMainPane, 'init', null, () => { this.addPreferenceElements(); });

    // Handle switch of preferences on load and when they changes
    setTimeout(() => { this.handleTabsModePreferenceSwitch(true); } );
    xPref.addListener(ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER, () => { this.handleOutOfScopePreferenceSwitch() } );
    xPref.addListener(ChromeLoader.PREF_ENABLE_TABS_MODE, () => { this.handleTabsModePreferenceSwitch() } );
  }

  addPreferenceData () {
    Preferences.addAll([
      { id: ChromeLoader.PREF_LINKS_TARGET, type: 'int' },
      { id: ChromeLoader.PREF_DISPLAY_URL_BAR, type: 'int' },
      { id: ChromeLoader.PREF_SITES_SET_THEME_COLOR, type: 'bool' },
      { id: ChromeLoader.PREF_SITES_SET_BACKGROUND_COLOR, type: 'bool' },
      { id: ChromeLoader.PREF_DYNAMIC_THEME_COLOR, type: 'bool' },
      { id: ChromeLoader.PREF_DYNAMIC_WINDOW_TITLE, type: 'bool' },
      { id: ChromeLoader.PREF_DYNAMIC_WINDOW_ICON, type: 'bool' },
      { id: ChromeLoader.PREF_ALWAYS_USE_NATIVE_WINDOW_CONTROLS, type: 'bool' },
      { id: ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER, type: 'bool' },
      { id: ChromeLoader.PREF_OPEN_IN_EXISTING_WINDOW, type: 'bool' },
      { id: ChromeLoader.PREF_ENABLE_TABS_MODE, type: 'bool' },
      { id: ChromeLoader.PREF_ALLOWED_DOMAINS, type: 'wstring' },
      { id: ChromeLoader.PREF_SHORTCUTS_CLOSE_TAB, type: 'bool' },
      { id: ChromeLoader.PREF_SHORTCUTS_CLOSE_WINDOW, type: 'bool' },
      { id: ChromeLoader.PREF_SHORTCUTS_QUIT_APPLICATION, type: 'bool' },
      { id: ChromeLoader.PREF_SHORTCUTS_PRIVATE_BROWSING, type: 'bool' },
    ]);
  }

  addPreferenceElements () {
    const firefoxpwaGroup = MozXULElement.parseXULToFragment(`
<groupbox id="firefoxpwaGroup" data-category="paneGeneral">
  <label>
    <html:h2>Progressive Web Apps</html:h2>
    <description>You may need to restart the browser to apply these settings</description>
  </label>

  <vbox id="colorsBox" style="padding-top: 1rem;">
    <checkbox preference="${ChromeLoader.PREF_SITES_SET_THEME_COLOR}" label="Allow web apps to override a theme (titlebar) color" />
    <checkbox preference="${ChromeLoader.PREF_SITES_SET_BACKGROUND_COLOR}" label="Allow web apps to override a background (window) color" />
    <checkbox preference="${ChromeLoader.PREF_DYNAMIC_THEME_COLOR}" label="Allow web apps to dynamically change a theme color" />
  </vbox>

  <vbox id="titlebarBox" style="padding-top: 1rem;">
    <checkbox preference="${ChromeLoader.PREF_DYNAMIC_WINDOW_TITLE}" label="Change the window title based on the web app's title" />
    <checkbox preference="${ChromeLoader.PREF_DYNAMIC_WINDOW_ICON}" label="Change the window icon based on the web app's icon" />
    <checkbox preference="${ChromeLoader.PREF_ALWAYS_USE_NATIVE_WINDOW_CONTROLS}" label="Always use native window controls" class="pref-csd-only" />
  </vbox>

   <vbox id="uxBox" style="padding-top: 1rem;">
    <checkbox preference="${ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER}" label="Open out-of-scope URLs in a default browser (can break some web apps)" />
    <checkbox preference="${ChromeLoader.PREF_ENABLE_TABS_MODE}" label="Show browser tabs and enable using multi-tabbed web apps" />
    <checkbox id="openInExistingWindowCheckbox" preference="${ChromeLoader.PREF_OPEN_IN_EXISTING_WINDOW}" label="Open a web app in an existing window of that web app" />
  </vbox>

  <vbox id="linksTargetBox" style="padding-top: 1rem;">
    <label>
      <description>When opening a link that should normally open in a new window or tab</description>
    </label>
    <vbox>
      <radiogroup id="linksTargetRadioGroup" preference="${ChromeLoader.PREF_LINKS_TARGET}">
        <radio value="1" label="Force links into the current tab" />
        <radio value="2" label="Force links into a new window" />
        <radio value="3" label="Force links into a new tab" />
        <radio value="0" label="Do not change link behaviour" />
      </radiogroup>
    </vbox>
  </vbox>

  <vbox id="displayUrlBarBox" style="padding-top: 1rem;">
    <label>
      <description>Display the address bar</description>
    </label>
    <vbox>
      <radiogroup id="displayUrlBarRadioGroup" preference="${ChromeLoader.PREF_DISPLAY_URL_BAR}">
        <radio value="0" label="When the URL is out-of-scope" />
        <radio value="2" label="Always" />
        <radio value="1" label="Never" />
      </radiogroup>
    </vbox>
  </vbox>

  <vbox id="allowedDomainsBox" style="padding-top: 1rem;">
    <label>
      <description>Domains always allowed to be opened in the app browser</description>
    </label>
    <vbox>
      <html:input type="text" placeholder="Enter a comma-separated list of domains..." preference="${ChromeLoader.PREF_ALLOWED_DOMAINS}" />
    </vbox>
  </vbox>
</groupbox>
`).firstChild;

    const shortcutsGroup = MozXULElement.parseXULToFragment(`
<groupbox id="shortcutsGroup" data-category="paneGeneral">
  <label>
    <html:h2>Keyboard Shortcuts</html:h2>
    <description>You may need to restart the browser to apply these settings</description>
  </label>
  <vbox id="shortcutsBox" style="padding-top: 1rem;">
    <checkbox preference="${ChromeLoader.PREF_SHORTCUTS_CLOSE_TAB}" label="Close tab (Ctrl+W)" />
    <checkbox preference="${ChromeLoader.PREF_SHORTCUTS_CLOSE_WINDOW}" label="Close window (Ctrl+Shift+W)" />
    <checkbox preference="${ChromeLoader.PREF_SHORTCUTS_QUIT_APPLICATION}" label="Quit application (Ctrl+Shift+Q)" />
    <checkbox preference="${ChromeLoader.PREF_SHORTCUTS_PRIVATE_BROWSING}" label="Private browsing (Ctrl+Shift+P)" />
  </vbox>
</groupbox>
`).firstChild;

    const startupGroup = document.getElementById('startupGroup');
    if (startupGroup.hidden) firefoxpwaGroup.hidden = true;
    if (startupGroup.hidden) shortcutsGroup.hidden = true;
    startupGroup.nextElementSibling.after(firefoxpwaGroup);
    startupGroup.nextElementSibling.nextElementSibling.after(shortcutsGroup);
  }

  handleOutOfScopePreferenceSwitch () {
    if (xPref.get(ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER)) {
      // If out-of-scope URLs in a default browser is enabled, set the links target to a new window
      xPref.set(ChromeLoader.PREF_LINKS_TARGET, 2)
    } else {
      // If the tabs mode is enabled, keep the links target unchanged
      if (xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE)) return;

      // Otherwise, set the links target to the current tab
      xPref.set(ChromeLoader.PREF_LINKS_TARGET, 1)
    }
  }

  handleTabsModePreferenceSwitch (onLoad = false) {
    function setTabsSectionDisabled(disabled) {
      document.querySelectorAll('#mainPrefPane > groupbox:nth-child(8) > *').forEach(elem => elem.disabled = disabled)
      document.querySelector('#openInExistingWindowCheckbox').disabled = disabled
    }

    if (xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE)) {
      // If the tabs mode is enabled, enable the tabs section and set the links target to a new tab
      setTabsSectionDisabled(false);
      setTimeout(() => setTabsSectionDisabled(false), 100);
      if (!onLoad) xPref.set(ChromeLoader.PREF_LINKS_TARGET, 3);
    } else {
      // If the tabs mode is disabled, disable the tabs section and open in existing window
      setTabsSectionDisabled(true)
      setTimeout(() => setTabsSectionDisabled(true), 100);
      xPref.set(ChromeLoader.PREF_OPEN_IN_EXISTING_WINDOW, false);

      if (!onLoad) {
        // If out-of-scope URLs in a default browser is enabled, keep the links target unchanged
        if (xPref.get(ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER)) return;

        // Otherwise, set the links target to the current tab
        xPref.set(ChromeLoader.PREF_LINKS_TARGET, 1);
      }
    }
  }
}

new PwaPreferences();
