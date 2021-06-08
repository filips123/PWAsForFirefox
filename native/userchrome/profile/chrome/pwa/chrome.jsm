const EXPORTED_SYMBOLS = [];

const { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');
const SSS = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);

class ChromeLoader {
  BROWSERCHROME = 'chrome://browser/content/browser.xhtml';

  FILES_BASE = Services.io.getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler).getURLSpecFromDir(Services.dirsvc.get('UChrm', Ci.nsIFile));
  SCRIPT_FILE = 'pwa/content/pwa.jsm';
  STYLES_FILE = 'pwa/content/pwa.css';

  static initialized = false;

  constructor () {
    Services.obs.addObserver(this, 'chrome-document-global-created', false);
  }

  observe (subject) {
    subject.addEventListener('DOMContentLoaded', this, { once: true });
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

    if (location.href === this.BROWSERCHROME) {
      SSS.loadAndRegisterSheet(Services.io.newURI(this.FILES_BASE + this.STYLES_FILE), SSS.USER_SHEET);
      Services.scriptloader.loadSubScript(this.FILES_BASE + this.SCRIPT_FILE, window, 'UTF-8');
    }
  }
}

if (!Services.appinfo.inSafeMode) {
  new ChromeLoader();
}
