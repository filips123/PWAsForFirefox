const EXPORTED_SYMBOLS = [];

const { XPCOMUtils } = ChromeUtils.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetters(this, {
  AppConstants: 'resource://gre/modules/AppConstants.jsm',
  Services: 'resource://gre/modules/Services.jsm',
  applySystemIntegration: 'resource://pwa/utils/systemIntegration.jsm',
});

const SSS = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);

class ChromeLoader {
  BROWSERCHROME = AppConstants.BROWSER_CHROME_URL;

  FILES_BASE = Services.io.getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler).getURLSpecFromDir(Services.dirsvc.get('UChrm', Ci.nsIFile));
  SCRIPT_FILE = 'pwa/content/pwa.jsm';
  STYLES_FILE = 'pwa/content/pwa.css';

  static initialized = false;

  constructor () {
    Services.obs.addObserver(this, 'chrome-document-global-created', false);
  }

  observe (window) {
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
    window.ChromeLoader = ChromeLoader;

    // Apply system integration
    if (window.gFFPWASiteConfig) {
      applySystemIntegration(window, window.gFFPWASiteConfig);
    }

    // Load CSS and JS when a new browser window is created
    if (location.href === this.BROWSERCHROME) {
      if (!ChromeLoader.initialized) {
        SSS.loadAndRegisterSheet(Services.io.newURI(this.FILES_BASE + this.STYLES_FILE), SSS.USER_SHEET);
      }

      Services.scriptloader.loadSubScript(this.FILES_BASE + this.SCRIPT_FILE, window, 'UTF-8');
      ChromeLoader.initialized = true;
    }
  }
}

if (!Services.appinfo.inSafeMode) {
  new ChromeLoader();
}
