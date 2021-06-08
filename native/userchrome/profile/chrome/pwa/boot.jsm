const EXPORTED_SYMBOLS = [];

let {
  classes: Cc,
  interfaces: Ci,
  manager: Cm
} = Components;

function readConfig () {
  const { OS } = ChromeUtils.import('resource://gre/modules/osfile.jsm');
  const { AppConstants } = ChromeUtils.import('resource://gre/modules/AppConstants.jsm');
  const { NetUtil } = ChromeUtils.import('resource://gre/modules/NetUtil.jsm');

  let configFilename = OS.Constants.Path.profileDir + '/../../config.json';
  if (AppConstants.platform === 'win') configFilename = configFilename.replaceAll('/', '\\');

  const configFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
  configFile.initWithPath(configFilename);

  const configStream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
  configStream.init(configFile, -1, 0, 0);

  const configJson = NetUtil.readInputStreamToString(configStream, configStream.available());
  return JSON.parse(configJson);
}

function launchSite (url, id) {
  const { AppConstants } = ChromeUtils.import('resource://gre/modules/AppConstants.jsm');
  const { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');

  const urls = Cc['@mozilla.org/array;1'].createInstance(Ci.nsIMutableArray);

  let urlStr = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
  urlStr.data = url;
  urls.appendElement(urlStr);

  const idStr = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
  idStr.data = id;
  urls.appendElement(idStr);

  return Services.ww.openWindow(null, AppConstants.BROWSER_CHROME_URL, '_blank', 'chrome,dialog=no,all', urls);
}

const cmanifest = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties).get('UChrm', Ci.nsIFile);
cmanifest.append('pwa');
cmanifest.append('chrome.manifest');
Cm.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(cmanifest);

const { nsDefaultCommandLineHandler } = Cu.import('resource:///modules/BrowserContentHandler.jsm');
nsDefaultCommandLineHandler.prototype._handle = nsDefaultCommandLineHandler.prototype.handle;
nsDefaultCommandLineHandler.prototype.handle = async function (cmdLine) {
  let siteId = cmdLine.handleFlagWithParam('pwa', false);
  if (siteId) {
    cmdLine.preventDefault = true;

    const { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');
    Services.startup.enterLastWindowClosingSurvivalArea();

    let config;
    try {
      config = readConfig();
    } catch (_) {
      dump('Failed to load the FirefoxPWA configuration file\n');
      return;
    }

    let startUrl;
    try {
      let userStartUrl = config.sites[siteId].config.start_url;
      let manifestStartUrl = config.sites[siteId].manifest.start_url;
      startUrl = userStartUrl ? userStartUrl : manifestStartUrl;
    } catch (_) {
      dump(`No PWA installed with requested ULID: ${siteId}\n`);
      return;
    }

    launchSite(startUrl, siteId);
    Services.startup.exitLastWindowClosingSurvivalArea();

  } else {
    this._handle(cmdLine);
  }
}

ChromeUtils.import('resource://pwa/chrome.jsm');
