import { AppConstants } from 'resource://gre/modules/AppConstants.sys.mjs';
import { NetUtil } from 'resource://gre/modules/NetUtil.sys.mjs';
import { nsContentDispatchChooser } from 'resource://gre/modules/ContentDispatchChooser.sys.mjs';
import { nsDefaultCommandLineHandler, nsBrowserContentHandler } from 'resource:///modules/BrowserContentHandler.sys.mjs';
import { BrowserGlue } from 'resource:///modules/BrowserGlue.sys.mjs';
import { BrowserWindowTracker } from 'resource:///modules/BrowserWindowTracker.sys.mjs';
import { WebProtocolHandlerRegistrar } from 'resource:///modules/WebProtocolHandlerRegistrar.sys.mjs';
import { OnboardingMessageProvider } from 'resource:///modules/asrouter/OnboardingMessageProvider.sys.mjs';

import { applySystemIntegration } from 'resource://pwa/utils/systemIntegration.sys.mjs';

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  sendNativeMessage: 'resource://pwa/utils/nativeMessaging.sys.mjs',
  sanitizeString: 'resource://pwa/utils/common.sys.mjs',
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
Services.prefs.getDefaultBranch(null).setIntPref('browser.sessionstore.max_resumed_crashes', 0);
Services.prefs.getDefaultBranch(null).setIntPref('browser.sessionstore.max_tabs_undo', 0);
Services.prefs.getDefaultBranch(null).setIntPref('browser.sessionstore.max_windows_undo', 0);
Services.prefs.getDefaultBranch(null).setBoolPref('browser.shell.checkDefaultBrowser', false);
Services.prefs.getDefaultBranch(null).setBoolPref('browser.startup.upgradeDialog.enabled', false);
Services.prefs.getDefaultBranch(null).setBoolPref('browser.privateWindowSeparation.enabled', false);
Services.prefs.getDefaultBranch(null).setBoolPref('browser.privacySegmentation.createdShortcut', true);

// Force disable vertical tabs until we figure out how to properly support them (#667)
Services.prefs.setBoolPref('sidebar.verticalTabs', false);
Services.prefs.setBoolPref('sidebar.revamp', false);

// Disable default browser prompt
BrowserGlue.prototype._maybeShowDefaultBrowserPrompt = async () => null;

// Disable onboarding messages
OnboardingMessageProvider.getMessages = async () => [];
OnboardingMessageProvider.getUntranslatedMessages = async () => [];

// Override command line helper to intercept PWAsForFirefox arguments and start loading the site
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
  nsBrowserContentHandler.prototype._getNewWindowArgs = nsBrowserContentHandler.prototype.getNewWindowArgs;
  nsBrowserContentHandler.prototype.getNewWindowArgs = function () {
    if (globalThis.gFFPWASiteConfig) {
      const userStartUrl = globalThis.gFFPWASiteConfig.config.start_url;
      const manifestStartUrl = globalThis.gFFPWASiteConfig.manifest.start_url;
      return userStartUrl ? userStartUrl : manifestStartUrl;
    } else {
      return this._getNewWindowArgs(...arguments);
    }
  }
}

// Allow opening HTTP(S) links in a default browser without a confirmation popup
nsContentDispatchChooser.prototype._hasProtocolHandlerPermissionOriginal = nsContentDispatchChooser.prototype._hasProtocolHandlerPermission;
nsContentDispatchChooser.prototype._hasProtocolHandlerPermission = function(scheme, principal, triggeredExternally) {
  if (scheme === 'http' || scheme === 'https') return true;
  return this._hasProtocolHandlerPermissionOriginal(scheme, principal, triggeredExternally);
};

// Handle opening new window from keyboard shortcuts
BrowserWindowTracker._openWindow = BrowserWindowTracker.openWindow;
BrowserWindowTracker.openWindow = function (options) {
  if (options.openerWindow && options.openerWindow.gFFPWASiteConfig && !options.args) {
    options.args = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
    options.args.data = options.openerWindow.HomePage.get(options.openerWindow);
  }
  return BrowserWindowTracker._openWindow(options);
};

// Some checks for protocol handlers are directly based on the Firefox code, licensed under MPL 2.0
// Original source: https://github.com/mozilla/gecko-dev/blob/a62618baa72cd0ba6c0a5f5fc0b1d63f2866b7c6/browser/components/protocolhandler/WebProtocolHandlerRegistrar.jsm

// Handle registering custom protocol handlers
WebProtocolHandlerRegistrar.prototype.registerProtocolHandler = function (protocol, url, title, documentURI, browserOrWindow) {
  protocol = (protocol || '').toLowerCase();
  if (!url || !documentURI) return;

  // Some special handling for e10s and non-e10s
  let browser = browserOrWindow;
  if (browserOrWindow instanceof Ci.nsIDOMWindow) {
    let rootDocShell = browserOrWindow.docShell.sameTypeRootTreeItem;
    browser = rootDocShell.QueryInterface(Ci.nsIDocShell).chromeEventHandler;
  }

  // Get the browser window
  let browserWindow = browser.ownerGlobal;

  // Check if protocol handler is allowed
  try { browser.ownerGlobal.navigator.checkProtocolHandlerAllowed(protocol, url, documentURI) }
  catch (_) { return }

  // If the protocol handler is already registered, just return early
  // We only allow one handler (either manifest or custom) per protocol scheme
  const existingHandlers = new Set([
    ...browserWindow.gFFPWASiteConfig.config.custom_protocol_handlers,
    ...browserWindow.gFFPWASiteConfig.manifest.protocol_handlers
  ].map(handler => lazy.sanitizeString(handler.protocol)).filter(handler => handler).sort());
  if (existingHandlers.has(protocol)) return;

  // Now ask the user and provide the proper callback
  const message = this._getFormattedString('addProtocolHandlerMessage', [url.host, protocol,]);

  const notificationBox = browser.getTabBrowser().getNotificationBox(browser);
  const notificationIcon = url.prePath + '/favicon.ico';
  const notificationValue = 'Protocol Registration: ' + protocol;

  const addButton = {
    label: this._getString('addProtocolHandlerAddButton'),
    accessKey: this._getString('addProtocolHandlerAddButtonAccesskey'),
    protocolInfo: { site: browserWindow.gFFPWASiteConfig.ulid, protocol: protocol, url: url.spec },

    async callback (notification, buttonInfo) {
      // Send a request to the native program to register the handler
      const response = await lazy.sendNativeMessage({
        cmd: 'RegisterProtocolHandler',
        params: {
          site: buttonInfo.protocolInfo.site,
          protocol: buttonInfo.protocolInfo.protocol,
          url: buttonInfo.protocolInfo.url,
        }
      });
      if (response.type === 'Error') throw new Error(response.data);
      if (response.type !== 'ProtocolHandlerRegistered') throw new Error(`Received invalid response type: ${response.type}`);

      // Reset the handlerInfo to ask before the next use
      const eps = Cc['@mozilla.org/uriloader/external-protocol-service;1'].getService(Ci.nsIExternalProtocolService);
      const handlerInfo = eps.getProtocolHandlerInfo(buttonInfo.protocolInfo.protocol);
      handlerInfo.alwaysAskBeforeHandling = true;

      const hs = Cc['@mozilla.org/uriloader/handler-service;1'].getService(Ci.nsIHandlerService);
      hs.store(handlerInfo);

      // Hide the notification
      notificationBox.currentNotification.close();
    },
  };

  notificationBox.appendNotification(
    notificationValue,
    {
      label: message,
      image: notificationIcon,
      priority: notificationBox.PRIORITY_INFO_LOW
    },
    [addButton]
  );
};

// Handle unregistering custom protocol handlers
// Disabled for now until we figure out how to access window from here
// WebProtocolHandlerRegistrar.prototype.removeProtocolHandler = function (protocol, url) {
//   (async () => {
//     // Send a request to the native program to unregister the handler
//     const response = await lazy.sendNativeMessage({
//       cmd: 'UnregisterProtocolHandler',
//       params: {
//         site: window.gFFPWASiteConfig.ulid,
//         protocol,
//         url,
//       }
//     });
//     if (response.type === 'Error') throw new Error(response.data);
//     if (response.type !== 'ProtocolHandlerUnregistered') throw new Error(`Received invalid response type: ${response.type}`);
//
//     // Reset the handlerInfo to ask before the next use
//     const eps = Cc['@mozilla.org/uriloader/external-protocol-service;1'].getService(Ci.nsIExternalProtocolService);
//     const handlerInfo = eps.getProtocolHandlerInfo(protocol);
//     handlerInfo.alwaysAskBeforeHandling = true;
//   })()
// };

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
ChromeUtils.importESModule('resource://pwa/chrome.sys.mjs');
