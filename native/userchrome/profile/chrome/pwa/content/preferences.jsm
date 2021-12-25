XPCOMUtils.defineLazyModuleGetters(this, {
  hookFunction: 'resource://pwa/utils/hookFunction.jsm',
  xPref: 'resource://pwa/utils/xPref.jsm',
});

class PwaPreferences {
  constructor () {
    this.addPreferenceData();
    hookFunction(gMainPane, 'init', null, () => { this.addPreferenceElements(); });

    // Handle switch of preferences on load and when they changes
    setTimeout(() => { this.handlePreferenceSwitch(true); } );
    xPref.addListener(ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER, () => { this.handlePreferenceSwitch() } );
    xPref.addListener(ChromeLoader.PREF_ENABLE_TABS_MODE, () => { this.handlePreferenceSwitch() } );
  }

  addPreferenceData () {
    Preferences.addAll([
      { id: ChromeLoader.PREF_LINKS_TARGET, type: 'int' },
      { id: ChromeLoader.PREF_DISPLAY_URL_BAR, type: 'int' },
      { id: ChromeLoader.PREF_SITES_SET_THEME_COLOR, type: 'bool' },
      { id: ChromeLoader.PREF_SITES_SET_BACKGROUND_COLOR, type: 'bool' },
      { id: ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER, type: 'bool' },
      { id: ChromeLoader.PREF_ENABLE_TABS_MODE, type: 'bool' },
      { id: ChromeLoader.PREF_ALLOWED_DOMAINS, type: 'wstring' },
    ]);
  }

  addPreferenceElements () {
    const group = MozXULElement.parseXULToFragment(`
<groupbox id="firefoxpwaGroup" data-category="paneGeneral">
  <label>
    <html:h2>Progressive Web Apps</html:h2>
    <description>You may need to restart the browser to apply this settings</description>
  </label>

  <vbox id="colorsBox" style="padding-top: 1rem;">
    <checkbox preference="${ChromeLoader.PREF_SITES_SET_THEME_COLOR}" label="Allow apps to override theme (titlebar) color" />
    <checkbox preference="${ChromeLoader.PREF_SITES_SET_BACKGROUND_COLOR}" label="Allow apps to override background (window) color" />
  </vbox>

   <vbox id="uxBox" style="padding-top: 1rem;">
    <checkbox preference="${ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER}" label="Open out of scope URLs in a default browser (can break some websites)" />
    <checkbox preference="${ChromeLoader.PREF_ENABLE_TABS_MODE}" label="Show browser tabs and enable using multiple tabs of the same app" />
  </vbox>

  <vbox id="linksTargetBox" style="padding-top: 1rem;">
    <label>
      <description>When opening a link that should normally open in a new window or tab</description>
    </label>
    <vbox>
      <radiogroup id="linksTargetRadioGroup" preference="${ChromeLoader.PREF_LINKS_TARGET}">
        <radio value="1" label="Force links into the current tab" />
        <radio value="2" label="Force links into a new window" />
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
        <radio value="0" label="When the URL is out of scope" />
        <radio value="2" label="Always" />
        <radio value="1" label="Never" />
      </radiogroup>
    </vbox>
  </vbox>

  <vbox id="allowedDomainsBox" style="padding-top: 1rem;">
    <label>
      <description>Domains always allowed to be opened in the PWA browser</description>
    </label>
    <vbox>
      <html:input type="text" placeholder="Enter a comma-separated list of domains..." preference="${ChromeLoader.PREF_ALLOWED_DOMAINS}" />
    </vbox>
  </vbox>
</groupbox>
`);
    document.getElementById('startupGroup').nextElementSibling.after(group.firstChild);
  }

  handlePreferenceSwitch (onLoad = false) {
    if (!onLoad) {
      if (xPref.get(ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER)) {
        // If out of scope URLs in a default browser are enabled, links target should default to new windows
        xPref.set(ChromeLoader.PREF_LINKS_TARGET, 2);
      } else {
        // Otherwise, it should default to current tab
        xPref.set(ChromeLoader.PREF_LINKS_TARGET, 1);
      }
    }

    if (xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE)) {
      // If tabs mode is enabled, enable tabs section and disable links target preference
      document.querySelectorAll('#mainPrefPane > groupbox:nth-child(8) > *').forEach(elem => elem.disabled = false)
      document.querySelectorAll('#linksTargetBox > *, #linksTargetBox > vbox > radiogroup > *').forEach(elem => elem.disabled = true)
    } else {
      // If tabs mode is disabled, disable tabs section and enable links target preference
      document.querySelectorAll('#mainPrefPane > groupbox:nth-child(8) > *').forEach(elem => elem.disabled = true)
      document.querySelectorAll('#linksTargetBox > *, #linksTargetBox > vbox > radiogroup > *').forEach(elem => elem.disabled = false)
    }
  }
}

new PwaPreferences();
