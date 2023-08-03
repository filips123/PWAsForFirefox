const EXPORTED_SYMBOLS = [];

const { XPCOMUtils } = ChromeUtils.import('resource://gre/modules/XPCOMUtils.jsm');
const Services = globalThis.Services || ChromeUtils.import('resource://gre/modules/Services.jsm').Services;
XPCOMUtils.defineLazyGetter(this, 'gSystemPrincipal', () => Services.scriptSecurityManager.getSystemPrincipal());
XPCOMUtils.defineLazyModuleGetters(this, {
  AppConstants: 'resource://gre/modules/AppConstants.jsm',
  NetUtil: 'resource://gre/modules/NetUtil.jsm',
  applySystemIntegration: 'resource://pwa/utils/systemIntegration.jsm',
});
XPCOMUtils.defineLazyServiceGetter(this, 'PromptService', '@mozilla.org/embedcomp/prompt-service;1', Ci.nsIPromptService);

/**
 * Read the PWAsForFirefox config file and parse it as JSON.
 *
 * Function determines config filename based on the current profile directory, and reads it
 * using internal Firefox functions. This relies on specific directory structure, so relocating
 * the profile directory or config file will break config reading.
 *
 * @returns {object} Config file as a parsed JSON object.
 */
function readConfig () {
  const profileDir = PathUtils.profileDir || Services.dirsvc.get('ProfD', Ci.nsIFile).path;
  const configDir = PathUtils.parent(PathUtils.parent(profileDir));
  const configFilename = PathUtils.join(configDir, 'config.json');

  const configFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
  const configStream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
  configFile.initWithPath(configFilename);
  configStream.init(configFile, 0x01, 0, 0);

  const configJson = NetUtil.readInputStreamToString(configStream, configStream.available());
  return JSON.parse(configJson);
}

/**
 * Launch the PWAsForFirefox site with URL and ID.
 *
 * The browser window will be passed the site URL, which will be automatically opened by the original
 * handler. It will also set the window `gFFPWASiteConfig` property with the configuration of the
 * specific site it's launching to allow to determining other PWA properties.
 *
 * @param {string} siteUrl - Site URL
 * @param {object} siteConfig - Site config
 * @param {boolean} isStartup - Is this initial launch (used to attempt to use the `navigator:blank` window)
 *
 * @returns {ChromeWindow&Window} The new window
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

  // Handle launching a web app when the same web app is already opened
  // We have to specify pref directly as we cannot access ChromeLoader yet
  const launchType = Services.prefs.getIntPref('firefoxpwa.launchType', 0);
  if (launchType) {
    for (const win of Services.wm.getEnumerator('navigator:browser')) {
      if (win.gFFPWASiteConfig?.ulid === siteConfig.ulid) {
        switch (launchType) {
          case 1:
            // Open a new tab in the existing window
            win.openTrustedLinkIn(siteUrl, 'tab', {});
            return win;
          case 2:
            // Open in an existing tab in the existing window
            win.openTrustedLinkIn(siteUrl, 'current', {});
            return win;
          case 3:
            // Focus the existing window
            win.focus();
            return win;
        }
      }
    }
  }

  // Try to use the `navigator:blank` window opened by `BrowserGlue.jsm` during early startup
  let win = Services.wm.getMostRecentWindow('navigator:blank');
  if (isStartup && win) {
    // Apply system integration
    applySystemIntegration(win, siteConfig);

    // Remove the window type of blank window so that we don't close it later
    win.document.documentElement.removeAttribute('windowtype');

    // Load the browser chrome and set site config
    const openTime = win.openTime;
    win.location = AppConstants.BROWSER_CHROME_URL;
    win.arguments = args;

    win.gFFPWASiteConfig = siteConfig;

    ChromeUtils.addProfilerMarker('earlyBlankWindowVisible', openTime);
    return win;
  }

  // Convert the window args to the correct format for `openWindow`
  const array = Cc['@mozilla.org/array;1'].createInstance(Ci.nsIMutableArray);
  args.forEach(arg => {
    if (typeof arg === 'string') {
      const string = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
      string.data = arg;
      arg = string;
    }

    array.appendElement(arg);
  });

  // Open a new browser window
  win = Services.ww.openWindow(null, AppConstants.BROWSER_CHROME_URL, '_blank', 'chrome,dialog=no,all', array);
  win.gFFPWASiteConfig = siteConfig;

  // Apply system integration
  applySystemIntegration(win, siteConfig);

  // Return window
  return win;
}

// Properly disable Firefox Session Restore
Services.prefs.getDefaultBranch(null).setBoolPref('browser.sessionstore.resume_from_crash', false);

// Override command line helper to intercept PWAsForFirefox arguments and start loading the site
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
    } catch (error) {
      console.error(error);
      PromptService.alert(null, null, 'Failed to load the PWAsForFirefox configuration file.');
      Services.wm.getMostRecentWindow('navigator:blank')?.close();
      return;
    }

    let startUrl;
    try {
      // Use user-specified start URL if it exists, otherwise use manifest-specified start URL
      let userStartUrl = config.sites[siteId].config.start_url;
      let manifestStartUrl = config.sites[siteId].manifest.start_url;
      startUrl = userStartUrl ? userStartUrl : manifestStartUrl;
    } catch (_) {
      PromptService.alert(null, null, `No web app installed with requested ULID: ${siteId}\n`);
      Services.wm.getMostRecentWindow('navigator:blank')?.close();
      return;
    }

    // Overwrite start URL by a command line parameter if it exists
    // This is used for launching site shortcuts and can be used to temporary overwrite start URL
    let commandUrl = cmdLine.handleFlagWithParam('url', false);
    if (commandUrl) startUrl = commandUrl;

    launchSite(startUrl, config.sites[siteId], isStartup);

  } else {
    this._handle(cmdLine);
  }
}

// Partial fix for reopening web app after closing all windows on macOS
// Still not complete because it does not work when multiple web apps are used in the same profile
// This does not matter currently because of #81, but once it is fixed, this also needs to be reworked
if (AppConstants.platform === 'macosx') {
  const { nsBrowserContentHandler } = Cu.import('resource:///modules/BrowserContentHandler.jsm');
  nsBrowserContentHandler.prototype._getArgs = nsBrowserContentHandler.prototype.getArgs;
  nsBrowserContentHandler.prototype.getArgs = function () {
    if (globalThis.gFFPWASiteConfig) {
      let userStartUrl = globalThis.gFFPWASiteConfig.config.start_url;
      let manifestStartUrl = globalThis.gFFPWASiteConfig.manifest.start_url;
      return userStartUrl ? userStartUrl : manifestStartUrl;
    } else {
      return this._getArgs(...arguments);
    }
  }
}

// Import browser chrome modifications
ChromeUtils.import('resource://pwa/chrome.jsm');
