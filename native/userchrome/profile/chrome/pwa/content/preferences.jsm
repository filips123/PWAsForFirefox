XPCOMUtils.defineLazyModuleGetters(this, {
  hookFunction: 'resource://pwa/utils/hookFunction.jsm',
  xPref: 'resource://pwa/utils/xPref.jsm',
});

class PwaPreferences {
  preferenceElementsAdded = false

  constructor () {
    this.addPreferenceData();
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

   <vbox id="launchTypeBox" style="padding-top: 1rem;">
    <label>
      <description>When launching a web app that is already opened</description>
    </label>
    <vbox>
      <radiogroup id="launchTypeRadioGroup" preference="${ChromeLoader.PREF_LAUNCH_TYPE}">
        <radio value="0" id="launchTypeNewWindow" label="Open web app in a new window" />
        <radio value="1" id="launchTypeNewTab" label="Open web app in a new tab" />
        <radio value="2" id="launchTypeReplace" label="Replace the existing tab" />
        <radio value="3" id="launchTypeFocus" label="Focus the existing window" />
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

  handleTabsModePreferenceSwitch (onLoad = false) {
    function setTabsSectionDisabled(disabled) {
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
