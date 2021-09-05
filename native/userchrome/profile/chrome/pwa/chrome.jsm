const EXPORTED_SYMBOLS = [];

const { XPCOMUtils } = ChromeUtils.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetters(this, {
  AppConstants: 'resource://gre/modules/AppConstants.jsm',
  Services: 'resource://gre/modules/Services.jsm',
  applySystemIntegration: 'resource://pwa/utils/systemIntegration.jsm',
});

const SSS = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);

class ChromeLoader {
  static BROWSERCHROME = AppConstants.BROWSER_CHROME_URL;
  static ABOUTPREFERENCES = 'about:preferences';
  static MACOS_HIDDEN_WINDOW = 'chrome://browser/content/hiddenWindowMac.xhtml';

  static FILES_BASE = Services.io.getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler).getURLSpecFromDir(Services.dirsvc.get('UChrm', Ci.nsIFile));

  static BROWSER_SCRIPT = 'pwa/content/browser.jsm';
  static BROWSER_STYLES = 'pwa/content/browser.css';
  static PREFERENCES_SCRIPT = 'pwa/content/preferences.jsm';
  static PREFERENCES_STYLES = 'pwa/content/preferences.css';
  static MACOS_HIDDEN_WINDOW_SCRIPT = 'pwa/content/macosHiddenWindow.jsm';

  static DISTRIBUTION_ID = 'firefoxpwa';
  static DISTRIBUTION_VERSION = '0.0.0';
  static DISTRIBUTION_ABOUT = 'With modifications by the FirefoxPWA project';

  static PREF_LINKS_TARGET = 'firefoxpwa.linksTarget';
  static PREF_DISPLAY_URL_BAR = 'firefoxpwa.displayUrlBar';
  static PREF_AUTOHIDE_MUTE_BUTTON = 'firefoxpwa.autohideMuteButton';
  static PREF_SITES_SET_THEME_COLOR = 'firefoxpwa.sitesSetThemeColor';
  static PREF_SITES_SET_BACKGROUND_COLOR = 'firefoxpwa.sitesSetBackgroundColor';
  static PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER = 'firefoxpwa.openOutOfScopeInDefaultBrowser';
  static PREF_ENABLE_TABS_MODE = 'firefoxpwa.enableTabsMode';
  static PREF_ENABLE_HIDING_ICON_BAR = 'firefoxpwa.enableHidingIconBar';
  static PREF_ALLOWED_DOMAINS = 'firefoxpwa.allowedDomains';

  static INITIALIZED_BROWSER = false;
  static INITIALIZED_PREFERENCES = false;

  constructor () {
    Services.obs.addObserver(this, 'chrome-document-global-created', false);
  }

  observe (window) {
    window.ChromeLoader = ChromeLoader;
    window.addEventListener('DOMContentLoaded', this, { once: true });
  }

  handleEvent (event) {
    /**
     * @type Document
     * @property {Window} originalTarget
     */
    let document = event.originalTarget;

    let window = document.defaultView;
    let location = window.location;

    if (window._gBrowser) window.gBrowser = window._gBrowser;

    // Apply system integration
    if (window.gFFPWASiteConfig) {
      applySystemIntegration(window, window.gFFPWASiteConfig);
    }

    // Load browser CSS and JS when a new browser window is created
    // Styles need to be loaded only once per session, but script needs to be loaded every time
    if (location.href === ChromeLoader.BROWSERCHROME) {
      if (!ChromeLoader.INITIALIZED_BROWSER) this.loadUserStyles(ChromeLoader.BROWSER_STYLES);
      this.loadUserScript(ChromeLoader.BROWSER_SCRIPT, window);
      ChromeLoader.INITIALIZED_BROWSER = true;

    // Load preferences CSS and JS when a new preferences tab is opened
    // Styles need to be loaded only once per session, but script needs to be loaded every time
    } else if (location.href === ChromeLoader.ABOUTPREFERENCES) {
      if (!ChromeLoader.INITIALIZED_PREFERENCES) this.loadUserStyles(ChromeLoader.PREFERENCES_STYLES);
      this.loadUserScript(ChromeLoader.PREFERENCES_SCRIPT, window);
      ChromeLoader.INITIALIZED_PREFERENCES = true;
    } else if (location.href === ChromeLoader.MACOS_HIDDEN_WINDOW) {
      this.loadUserScript(ChromeLoader.MACOS_HIDDEN_WINDOW_SCRIPT, window);
    }
  }

  loadUserStyles (stylesFilename) {
    return SSS.loadAndRegisterSheet(Services.io.newURI(ChromeLoader.FILES_BASE + stylesFilename), SSS.USER_SHEET);
  }

  loadUserScript (scriptFilename, window) {
    return Services.scriptloader.loadSubScript(ChromeLoader.FILES_BASE + scriptFilename, window, 'UTF-8');
  }
}

if (!Services.appinfo.inSafeMode) {
  new ChromeLoader();
}
