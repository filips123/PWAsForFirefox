XPCOMUtils.defineLazyModuleGetters(this, {
  hookFunction: 'resource://pwa/utils/hookFunction.jsm',
  xPref: 'resource://pwa/utils/xPref.jsm',
});

class PwaPreferences {
  constructor () {
    this.addPreferenceData();
    this.addPreferenceElements();
  }

  addPreferenceData () {
    Preferences.addAll([
      { id: ChromeLoader.PREF_LINKS_TARGET, type: 'int' },
      { id: ChromeLoader.PREF_DISPLAY_URL_BAR, type: 'int' },
      { id: ChromeLoader.PREF_SITES_SET_THEME_COLOR, type: 'bool' },
      { id: ChromeLoader.PREF_SITES_SET_BACKGROUND_COLOR, type: 'bool' },
    ]);
  }

  addPreferenceElements () {
    hookFunction(gMainPane, 'init', null, () => {
      const group = MozXULElement.parseXULToFragment(`
<groupbox id="firefoxpwaGroup" data-category="paneGeneral">
  <label><html:h2>Progressive Web Apps</html:h2></label>

  <vbox id="colorsBox">
    <checkbox preference="${ChromeLoader.PREF_SITES_SET_THEME_COLOR}" label="Allow apps to override theme (titlebar) color" />
    <checkbox preference="${ChromeLoader.PREF_SITES_SET_BACKGROUND_COLOR}" label="Allow apps to override background (window) color" />
  </vbox>

  <vbox id="linksTargetBox" style="padding-top: 1rem;">
    <description>When opening a link that should normally open in a new window or tab</description>
    <vbox>
      <radiogroup id="linksTargetRadioGroup" preference="${ChromeLoader.PREF_LINKS_TARGET}">
        <radio value="1" label="Force links into the current tab" />
        <radio value="2" label="Force links into a new window" />
        <radio value="0" label="Do not change link behaviour" />
      </radiogroup>
    </vbox>
  </vbox>

  <vbox id="displayUrlBarBox" style="padding-top: 1rem;">
    <description>Display the address bar</description>
    <vbox>
      <radiogroup id="displayUrlBarRadioGroup" preference="${ChromeLoader.PREF_DISPLAY_URL_BAR}">
        <radio value="0" label="When the URL is out of scope" />
        <radio value="2" label="Always" />
        <radio value="1" label="Never" />
      </radiogroup>
    </vbox>
  </vbox>
</groupbox>
`);
      document.getElementById('startupGroup').nextElementSibling.after(group.firstChild);
    });
  }
}

new PwaPreferences();
