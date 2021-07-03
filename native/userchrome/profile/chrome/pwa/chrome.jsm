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

  static FILES_BASE = Services.io.getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler).getURLSpecFromDir(Services.dirsvc.get('UChrm', Ci.nsIFile));
  static SCRIPT_FILE = 'pwa/content/pwa.jsm';
  static STYLES_FILE = 'pwa/content/pwa.css';

  static DISTRIBUTION_ID = 'firefoxpwa';
  static DISTRIBUTION_VERSION = '0.0.0';
  static DISTRIBUTION_ABOUT = 'With modifications by the FirefoxPWA project';

  static PREF_LINKS_TARGET = 'firefoxpwa.linksTarget';
  static PREF_DISPLAY_URL_BAR = 'firefoxpwa.displayUrlBar';
  static PREF_SITES_SET_THEME_COLOR = 'firefoxpwa.sitesSetThemeColor';
  static PREF_SITES_SET_BACKGROUND_COLOR = 'firefoxpwa.sitesSetBackgroundColor';

  static initialized = false;

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

    // Load CSS and JS when a new browser window is created
    if (location.href === ChromeLoader.BROWSERCHROME) {
      if (!ChromeLoader.initialized) {
        SSS.loadAndRegisterSheet(Services.io.newURI(ChromeLoader.FILES_BASE + ChromeLoader.STYLES_FILE), SSS.USER_SHEET);
      }

      Services.scriptloader.loadSubScript(ChromeLoader.FILES_BASE + ChromeLoader.SCRIPT_FILE, window, 'UTF-8');
      ChromeLoader.initialized = true;
    }
  }
}

if (!Services.appinfo.inSafeMode) {
  new ChromeLoader();
}
