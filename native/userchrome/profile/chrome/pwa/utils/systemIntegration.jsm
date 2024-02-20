const EXPORTED_SYMBOLS = ['buildIconList', 'applySystemIntegration', 'applyDynamicThemeColor'];

const { XPCOMUtils } = ChromeUtils.import('resource://gre/modules/XPCOMUtils.jsm');
const Services = globalThis.Services || ChromeUtils.import('resource://gre/modules/Services.jsm').Services;
XPCOMUtils.defineLazyModuleGetters(this, {
  AppConstants: 'resource://gre/modules/AppConstants.jsm',
  ImageTools: 'resource:///modules/ssb/ImageTools.jsm',
  NetUtil: 'resource://gre/modules/NetUtil.jsm',
  xPref: 'resource://pwa/utils/xPref.jsm',
});
XPCOMUtils.defineLazyServiceGetter(this, 'ImgTools', '@mozilla.org/image/tools;1', Ci.imgITools);
XPCOMUtils.defineLazyServiceGetter(this, 'WinUIUtils', '@mozilla.org/windows-ui-utils;1', Ci.nsIWindowsUIUtils);
XPCOMUtils.defineLazyServiceGetter(this, 'WinTaskbar', '@mozilla.org/windows-taskbar;1', Ci.nsIWinTaskbar);

/**
 * @param {Window} window
 * @param {String} elementId
 * @returns {HTMLElement}
 */
function createOrGetStyles(window, elementId) {
  let styles = window.document.getElementById(elementId);

  if (styles) {
    styles.innerHTML = '';
  } else {
    styles = window.document.head.appendChild(window.document.createElement('style'));
    styles.setAttribute('id', elementId);
  }

  return styles;
}

function configureThemeColor (window, styles, colorR, colorG, colorB) {
  const backgroundColor = `rgb(${colorR}, ${colorG}, ${colorB})`

  // Implementation of W3C contrast algorithm: https://www.w3.org/TR/AERT/#color-contrast
  const brightness = Math.round(((colorR * 299) + (colorG * 587) + (colorB * 114)) / 1000);
  const textColor = (brightness > 125) ? 'black' : 'white';

  // Set toolbar color to fix wrong window controls on Linux
  if (AppConstants.platform === 'linux' && window.document.documentElement.getAttribute('lwtheme') !== 'true') {
    if (brightness > 125) xPref.set('browser.theme.toolbar-theme', 1); // Light theme
    else xPref.set('browser.theme.toolbar-theme', 0); // Dark theme
  }

  // Set background and text colors to the titlebar and tabs
  styles.innerHTML += `#navigator-toolbox, html[tabsintitlebar] #main-menubar > *, html[tabsintitlebar] #titlebar > * { background-color: ${backgroundColor} !important; color: ${textColor} !important; }`;
  styles.innerHTML += `.tabbrowser-tab { color: ${textColor} !important; }`;
}

function loadImage (uri) {
  return new Promise((resolve, reject) => {
    let channel = NetUtil.newChannel({
      uri: uri,
      loadUsingSystemPrincipal: true,
    });

    ImgTools.decodeImageFromChannelAsync(
      uri,
      channel,
      (container, status) => {
        if (Components.isSuccessCode(status)) {
          resolve({
            type: channel.contentType,
            container,
          });
        } else {
          reject(Components.Exception('Failed to load image', status));
        }
      },
      null
    );
  });
}

function buildIconList (icons, purpose = 'any') {
  let iconList = [];

  for (let icon of icons) {
    if (!icon.purpose.split().includes(purpose)) continue;

    for (let sizeSpec of icon.sizes.split()) {
      const size = sizeSpec === 'any' ? Number.MAX_SAFE_INTEGER : parseInt(sizeSpec);
      iconList.push({ icon, size });
    }
  }

  iconList.sort((a, b) => (a.size > b.size) ? 1 : -1);
  return iconList;
}

async function getIcon (icons, size) {
  if (icons.length === 0) return null;

  let icon = icons.find(icon => icon.size >= size);
  if (!icon) icon = icons[icons.length - 1];

  try {
    let image = await loadImage(Services.io.newURI(icon.icon.src));
    return image.container;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function setWindowIcons (window, site) {
  let iconList = buildIconList(site.config.icon_url ? [{
    purpose: 'any',
    sizes: 'any',
    src: site.config.icon_url,
  }] : site.manifest.icons);

  let windowIcons = await Promise.all([
    getIcon(iconList, WinUIUtils.systemSmallIconSize),
    getIcon(iconList, WinUIUtils.systemLargeIconSize),
  ]);

  if (windowIcons[0] || windowIcons[1]) {
    // There is a small delay here because otherwise `setWindowIcon` may fail
    // It shouldn't visually matter because the icon will be set by a shortcut anyway
    window.setTimeout(() => {
      WinUIUtils.setWindowIcon(window, windowIcons[0], windowIcons[1]);
    }, 100);
  }
}

function setWindowColors (window, site) {
  // We need to remove alpha/transparency channel because windows cannot be transparent
  // Colors will always be in #rrggbb or #rrggbbaa because they are processed by a Rust library

  const stylesElementId = 'firefoxpwa-system-integration-styles';
  const styles = createOrGetStyles(window, stylesElementId);

  // Set the window background color
  if (xPref.get(window.ChromeLoader.PREF_SITES_SET_BACKGROUND_COLOR) && site.manifest.background_color) {
    const backgroundColor = site.manifest.background_color.substring(0, 7);

    // Set background color to the browser window
    styles.innerHTML += `#tabbrowser-tabpanels { background-color: ${backgroundColor} !important; }`;

    // Set background color to the website content
    const bodyStyle = `@-moz-document url-prefix(${site.manifest.scope}) { html { background-color: ${backgroundColor}; } }`
    const bodyUrl = Services.io.newURI(`data:text/css;base64,${btoa(bodyStyle)}`);
    const SSS = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
    SSS.loadAndRegisterSheet(bodyUrl, SSS.USER_SHEET);

    // Remove website content style modifications after some time (so website styles have time to load)
    window.setTimeout(() => {
      SSS.unregisterSheet(bodyUrl, SSS.USER_SHEET);
    }, 800);
  }

  // Set the theme (titlebar) background and text colors
  if (xPref.get(window.ChromeLoader.PREF_SITES_SET_THEME_COLOR) && site.manifest.theme_color) {
    const colorHex = site.manifest.theme_color.substring(0, 7);
    const colorRGB = colorHex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i).slice(1).map(c => parseInt(c, 16));
    configureThemeColor(window, styles, colorRGB[0], colorRGB[1], colorRGB[2]);
  }
}

/**
 * Apply system integration to the provided window for the provided PWA site.
 *
 * On Windows, this function sets the AppUserModelID (GroupID) property of the
 * window, allowing grouping multiple windows of the same site in the Windows
 * taskbar and preventing grouping different sites. It also sets taskbar windows
 * icons to prevent incorrect behavior when pinning/unpinning the shortcut.
 *
 * On all systems it sets the window name, the window `icon` attribute to prevent
 * problems on some desktop environments (for example, Xfce), `windowclass` and
 * `windowname` attributes to prevent grouping different web apps, and window
 * colors based on the colors from the manifest.
 *
 * @param {ChromeWindow&Window} window - Window where integration should be applied
 * @param {object} site - Site config for which integration should be used
 */
function applySystemIntegration (window, site) {
  // Set title only on the main browser chrome window
  if (window.location.href === AppConstants.BROWSER_CHROME_URL) {
    window.document.title = site.config.name || site.manifest.name || site.manifest.short_name;
  }

  window.document.documentElement.setAttribute('icon', `FFPWA-${site.ulid}`);
  window.document.documentElement.setAttribute('windowclass', `FFPWA-${site.ulid}`);
  window.document.documentElement.setAttribute('windowname', `FFPWA-${site.ulid}`);

  if (AppConstants.platform === 'win') {
    WinTaskbar.setGroupIdForWindow(window, `filips.firefoxpwa.${site.ulid}`);
    setWindowIcons(window, site);
  }

  // This needs some timeout so it can read preferences
  window.setTimeout(() => {
    if (!window.document.head) return;
    setWindowColors(window, site);
  }, 0);
}

/**
 * Apply dynamic theme color from the content's meta tag.
 *
 * @param {ChromeWindow&Window} window - Window where integration should be applied
 * @param {{r: Number, g: Number, b: Number, a: Number}} color - Color that should be applied
 */
function applyDynamicThemeColor (window, color) {
  const stylesElementId = 'firefoxpwa-system-integration-styles-dynamic';
  const styles = createOrGetStyles(window, stylesElementId);
  configureThemeColor(window, styles, color.r, color.g, color.b);
}
