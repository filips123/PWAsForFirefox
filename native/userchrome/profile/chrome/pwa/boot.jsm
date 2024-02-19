const EXPORTED_SYMBOLS = [];

const { XPCOMUtils } = ChromeUtils.import('resource://gre/modules/XPCOMUtils.jsm');
const Services = globalThis.Services || ChromeUtils.import('resource://gre/modules/Services.jsm').Services;
XPCOMUtils.defineLazyGetter(this, 'gSystemPrincipal', () => Services.scriptSecurityManager.getSystemPrincipal());
XPCOMUtils.defineLazyModuleGetters(this, {
  AppConstants: 'resource://gre/modules/AppConstants.jsm',
  BrowserWindowTracker: 'resource:///modules/BrowserWindowTracker.jsm',
  NetUtil: 'resource://gre/modules/NetUtil.jsm',
  LangPackMatcher: 'resource://gre/modules/LangPackMatcher.jsm',
  applySystemIntegration: 'resource://pwa/utils/systemIntegration.jsm',
});

/**
 * Reads the PWAsForFirefox config file and parses it as JSON.
 *
 * Function determines config filename based on the current profile directory, and reads it
 * using internal Firefox functions. This relies on specific directory structure, so relocating
 * the profile directory or config file will break config reading.
 *
 * @returns {object} - The config file content as a parsed JSON object.
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
 * Launches a web app with the provided URL list and sets its config.
 *
 * The function launches a new browser window (or uses an existing one, depending on the user settings)
 * with the provided URL list. It also sets the window's `gFFPWASiteConfig` property with the configuration
 * of the specific web app it's launching to allow determining other web app properties and features.
 *
 * @param {object} siteConfig - The web app config.
 * @param {string[]} urlList - The list of URLs to open.
 * @param {boolean} isStartup - If this is the initial launch. Used to attempt to use the `navigator:blank` window.
 *
 * @returns {ChromeWindow&Window} - The new window.
 */
function launchSite (siteConfig, urlList, isStartup) {
  // Handle launching a web app when the same web app is already opened
  // We have to specify pref directly as we cannot access ChromeLoader yet
  const launchType = Services.prefs.getIntPref('firefoxpwa.launchType', 0);
  if (launchType) {
    for (const win of Services.wm.getEnumerator('navigator:browser')) {
      if (win.gFFPWASiteConfig?.ulid === siteConfig.ulid) {
        for (const url of urlList) {
          switch (launchType) {
            case 1:
              // Open a new tab in the existing window
              win.openTrustedLinkIn(url, 'tab', {});
              break;
            case 2:
              // Open in an existing tab in the existing window
              win.openTrustedLinkIn(url, 'current', {});
              break;
            case 3:
              // Focus the existing window
              win.focus();
              break;
          }
        }
        return win;
      }
    }
  }

  // Passing an `nsIArray` for the URL disables the `|`-splitting behavior
  const urlArray = Cc['@mozilla.org/array;1'].createInstance(Ci.nsIMutableArray);
  urlList.forEach(url => {
    const string = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
    string.data = url;
    urlArray.appendElement(string);
  });

  // Try to use the `navigator:blank` window opened by `BrowserGlue` during early startup
  if (isStartup) {
    const win = Services.wm.getMostRecentWindow('navigator:blank');
    if (win) {
      // Apply the system integration and set the site config
      applySystemIntegration(win, siteConfig);
      win.gFFPWASiteConfig = siteConfig;

      // Remove the window type of blank window so that we don't close it later
      win.document.documentElement.removeAttribute('windowtype');

      // Load the browser chrome and register the window
      const openTime = win.openTime;
      win.location = AppConstants.BROWSER_CHROME_URL;
      win.arguments = [urlArray];

      ChromeUtils.addProfilerMarker('earlyBlankWindowVisible', openTime);
      BrowserWindowTracker.registerOpeningWindow(win, false);
      return win;
    }
  }

  // Open a new browser window through the window tracker
  const argsArray = Cc['@mozilla.org/array;1'].createInstance(Ci.nsIMutableArray);
  argsArray.appendElement(urlArray);
  const win = BrowserWindowTracker.openWindow({ args: argsArray });

  // Apply the system integration and set the site config
  applySystemIntegration(win, siteConfig);
  win.gFFPWASiteConfig = siteConfig;

  return win;
}

// Properly disable Firefox Session Restore and Private Window Separation
Services.prefs.getDefaultBranch(null).setBoolPref('browser.sessionstore.resume_from_crash', false);
Services.prefs.getDefaultBranch(null).setBoolPref('browser.privateWindowSeparation.enabled', false);
Services.prefs.getDefaultBranch(null).setBoolPref('browser.privacySegmentation.createdShortcut', true);

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
      Services.prompt.alert(null, null, 'Failed to load the PWAsForFirefox configuration file.');
      Services.wm.getMostRecentWindow('navigator:blank')?.close();
      return;
    }

    let siteConfig;
    try {
      siteConfig = config.sites[siteId];
    } catch (_) {
      Services.prompt.alert(null, null, `No web app installed with requested ULID: ${siteId}\n`);
      Services.wm.getMostRecentWindow('navigator:blank')?.close();
      return;
    }

    // Parse start URLs from the provided arguments
    // Can be used for launching shortcuts or to temporarily overwrite start URL
    const urlList = [];
    let urlArgument;
    while ((urlArgument = cmdLine.handleFlagWithParam('url', false))) {
      const fixedUrl = Services.uriFixup.getFixupURIInfo(urlArgument, Services.uriFixup.FIXUP_FLAG_NONE).preferredURI;
      if (fixedUrl.schemeIs('chrome')) continue;
      urlList.push(fixedUrl.spec);
    }

    if (!urlList.length) {
      // If no URLs are provided in arguments, obtain the default start URL
      // Use user-specified start URL if it exists, otherwise use manifest-specified start URL
      const userStartUrl = siteConfig.config.start_url;
      const manifestStartUrl = siteConfig.manifest.start_url;
      urlList.push(userStartUrl ? userStartUrl : manifestStartUrl);
    }

    launchSite(siteConfig, urlList, isStartup);
    return;
  }

  this._handle(cmdLine);
}

// Partial fix for reopening web app after closing all windows on macOS (#42)
// Still does not work when multiple web apps are used in the same profile
// This does not matter currently because of #81, but once it is fixed, this also needs to be reworked
if (AppConstants.platform === 'macosx') {
  const { nsBrowserContentHandler } = Cu.import('resource:///modules/BrowserContentHandler.jsm');
  nsBrowserContentHandler.prototype._getArgs = nsBrowserContentHandler.prototype.getArgs;
  nsBrowserContentHandler.prototype.getArgs = function () {
    if (globalThis.gFFPWASiteConfig) {
      const userStartUrl = globalThis.gFFPWASiteConfig.config.start_url;
      const manifestStartUrl = globalThis.gFFPWASiteConfig.manifest.start_url;
      return userStartUrl ? userStartUrl : manifestStartUrl;
    } else {
      return this._getArgs(...arguments);
    }
  }
}

// Register a localization source for the packaged locales
Services.obs.addObserver(async () => {
  const languages =  Services.locale.packagedLocales;
  if (!languages.includes('en-US')) languages.push('en-US');
  if (!languages.includes(Services.locale.defaultLocale)) languages.push(Services.locale.defaultLocale);
  const source = new L10nFileSource('9-pwa', 'app', languages, 'resource://pwa/localization/{locale}/');
  L10nRegistry.getInstance().registerSources([source]);
}, 'final-ui-startup');

// Listen to langpack startup events and register new sources when needed
Services.obs.addObserver(async subject => {
  const { langpackId, languages } = subject.wrappedJSObject.langpack.startupData;
  const sourceId = `pwa-${langpackId}`;

  // We exclude the default locale because it is included in the app metasource
  if (languages.includes(Services.locale.defaultLocale)) return;

  if (!L10nRegistry.getInstance().getSourceNames().includes(sourceId)) {
    const source = new L10nFileSource(sourceId, langpackId, languages, 'resource://pwa/localization/{locale}/');
    L10nRegistry.getInstance().registerSources([source]);
  }
}, 'webextension-langpack-startup');

// Import browser chrome modifications
ChromeUtils.import('resource://pwa/chrome.jsm');
