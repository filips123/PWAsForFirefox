const EXPORTED_SYMBOLS = [];

let {
  classes: Cc,
  interfaces: Ci,
  manager: Cm
} = Components;

const { XPCOMUtils } = ChromeUtils.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyGetter(this, 'gSystemPrincipal', () => Services.scriptSecurityManager.getSystemPrincipal());
XPCOMUtils.defineLazyModuleGetters(this, {
  AppConstants: 'resource://gre/modules/AppConstants.jsm',
  NetUtil: 'resource://gre/modules/NetUtil.jsm',
  OS: 'resource://gre/modules/osfile.jsm',
  Services: 'resource://gre/modules/Services.jsm',
});

/**
 * Read the FirefoxPWA config file and parse it as JSON.
 *
 * Function determines config filename based on the current profile directory, and reads it
 * using internal Firefox functions. This relies on specific directory structure, so relocating
 * the profile directory or config file will break config reading.
 *
 * @returns {object} Config file as a parsed JSON object.
 */
function readConfig () {
  let configFilename = OS.Constants.Path.profileDir + '/../../config.json';
  if (AppConstants.platform === 'win') configFilename = configFilename.replaceAll('/', '\\');

  const configFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
  configFile.initWithPath(configFilename);

  const configStream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
  configStream.init(configFile, -1, 0, 0);

  const configJson = NetUtil.readInputStreamToString(configStream, configStream.available());
  return JSON.parse(configJson);
}

/**
 * Launch the FirefoxPWA site with URL and ID.
 *
 * The browser window will be passed the site URL, which will be automatically opened by the original
 * handler. It will also set the window `gFFPWASiteConfig` property with the configuration of the
 * specific site it's launching to allow to determining other PWA properties.
 *
 * @param {string} siteUrl - Site URL
 * @param {object} siteConfig - Site config
 * @param {boolean} isStartup - Is this initial launch (used to attempt to use the `navigator:blank` window)
 *
 * @returns ChromeWindow The new window
 */
function launchSite (siteUrl, siteConfig, isStartup) {
  const args = [
    siteUrl,
    null,
    null,
    null,
    undefined,
    undefined,
    null,
    null,
    gSystemPrincipal,
  ];

  // Try to use the `navigator:blank` window opened by `BrowserGlue.jsm` during early startup
  let win = Services.wm.getMostRecentWindow('navigator:blank');
  if (isStartup && win) {
    win.document.documentElement.removeAttribute('windowtype');

    let openTime = win.openTime;
    win.location = AppConstants.BROWSER_CHROME_URL;
    win.arguments = args;

    win.gFFPWASiteConfig = siteConfig;

    ChromeUtils.addProfilerMarker('earlyBlankWindowVisible', openTime);
    return win;
  }

  // Convert the window args to the correct format for `openWindow`
  let array = Cc['@mozilla.org/array;1'].createInstance(Ci.nsIMutableArray);
  args.forEach(arg => {
    if (typeof arg === 'string') {
      let string = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
      string.data = arg;
      arg = string;
    }

    array.appendElement(arg);
  });

  // Open a new browser window
  win = Services.ww.openWindow(null, AppConstants.BROWSER_CHROME_URL, '_blank', 'chrome,dialog=no,all', array);
  win.gFFPWASiteConfig = siteConfig;
  return win;
}

// Register chrome manifest to load FirefoxPWA browser chrome modifications
const cmanifest = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties).get('UChrm', Ci.nsIFile);
cmanifest.append('pwa');
cmanifest.append('chrome.manifest');
Cm.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(cmanifest);

// Override command line helper to intercept FirefoxPWA arguments and start loading the site
const { nsDefaultCommandLineHandler } = Cu.import('resource:///modules/BrowserContentHandler.jsm');
nsDefaultCommandLineHandler.prototype._handle = nsDefaultCommandLineHandler.prototype.handle;
nsDefaultCommandLineHandler.prototype.handle = function (cmdLine) {
  const isStartup = cmdLine.state === Ci.nsICommandLine.STATE_INITIAL_LAUNCH;
  const siteId = cmdLine.handleFlagWithParam('pwa', false);

  if (siteId) {
    cmdLine.preventDefault = true;

    let config;
    try {
      config = readConfig();
    } catch (_) {
      dump('Failed to load the FirefoxPWA configuration file\n');
      return;
    }

    let startUrl;
    try {
      // Use user-specified start URL if it exists, otherwise use manifest-specified start URL
      let userStartUrl = config.sites[siteId].config.start_url;
      let manifestStartUrl = config.sites[siteId].manifest.start_url;
      startUrl = userStartUrl ? userStartUrl : manifestStartUrl;
    } catch (_) {
      dump(`No PWA installed with requested ULID: ${siteId}\n`);
      return;
    }

    launchSite(startUrl, config.sites[siteId], isStartup);

  } else {
    this._handle(cmdLine);
  }
}

// Import browser chrome modifications
ChromeUtils.import('resource://pwa/chrome.jsm');
