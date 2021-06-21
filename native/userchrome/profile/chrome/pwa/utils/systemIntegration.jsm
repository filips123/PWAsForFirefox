const EXPORTED_SYMBOLS = ['applySystemIntegration'];

const { XPCOMUtils } = ChromeUtils.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetters(this, {
  AppConstants: 'resource://gre/modules/AppConstants.jsm',
  ImageTools: 'resource:///modules/ssb/ImageTools.jsm',
  NetUtil: 'resource://gre/modules/NetUtil.jsm',
  Services: 'resource://gre/modules/Services.jsm',
});

XPCOMUtils.defineLazyServiceGetter(this, 'ImgTools', '@mozilla.org/image/tools;1', Ci.imgITools);
XPCOMUtils.defineLazyServiceGetter(this, 'WinUIUtils', '@mozilla.org/windows-ui-utils;1', Ci.nsIWindowsUIUtils);
XPCOMUtils.defineLazyServiceGetter(this, 'WinTaskbar', '@mozilla.org/windows-taskbar;1', Ci.nsIWinTaskbar);

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
  let iconList = buildIconList(site.manifest.icons);
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

  let styles = window.document.getElementById(stylesElementId);
  if (styles) {
    styles.innerHTML = '';
  } else {
    styles = window.document.head.appendChild(window.document.createElement('style'));
    styles.setAttribute('id', stylesElementId);
  }

  // Set the window background color
  if (site.manifest.background_color) {
    const backgroundColor = site.manifest.background_color.substring(0, 7);

    // Set background color to the browser window
    styles.innerHTML += `browser[primary="true"] { background-color: ${backgroundColor} !important; }`;

    // Set background color to the website body
    const bodyStyle = `@-moz-document url-prefix(${site.manifest.scope}) { html { background-color: ${backgroundColor}; } }`
    const SSS = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
    SSS.loadAndRegisterSheet(Services.io.newURI(`data:text/css;base64,${btoa(bodyStyle)}`), SSS.USER_SHEET);
  }

  // Set the theme (titlebar) background and text colors
  if (site.manifest.theme_color) {
    const themeColor = site.manifest.theme_color.substring(0, 7);

    // Implementation of W3C contrast algorithm: https://www.w3.org/TR/AERT/#color-contrast
    const colors = themeColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i).slice(1).map(c => parseInt(c, 16));
    const brightness = Math.round(((colors[0] * 299) + (colors[1] * 587) + (colors[2] * 114)) / 1000);
    const textColor = (brightness > 125) ? 'black' : 'white';

    // Set background and text colors to the titlebar
    styles.innerHTML += `#navigator-toolbox { background-color: ${themeColor} !important; color: ${textColor} !important; }`;

    // Some Gtk+ themes use rounded corners, so Firefox by default disables styling of the titlebar
    // We need to detect and prevent this, and add own rounded corners using CSS
    // However, if user enabled a custom theme, we need to disable them to prevent white corners
    if (window.matchMedia('(-moz-gtk-csd-available) and (-moz-gtk-csd-transparent-background)').matches) {
      styles.innerHTML += '#titlebar { visibility: hidden; } #titlebar > * { visibility: visible; }';
      styles.innerHTML += 'html[tabsintitlebar][sizemode="normal"]:not([gtktiledwindow="true"]):not([lwtheme="true"]) body { border-radius: 4px 4px 0 0; }';
    }
  }
}

/**
 * Apply system integration to the provided window for the provided PWA site.
 *
 * On Windows, this function sets the AppUserModelID (GroupID) property of the
 * window,  allowing grouping multiple windows of the same site in the Windows
 * taskbar and preventing grouping different sites. It also sets taskbar windows
 * icons to prevent incorrect behaviour when pinning/unpinning the shortcut.
 *
 * On all systems it also sets window colors based on the colors from the manifest.
 *
 * @param {ChromeWindow} window - Window where integration should be applied
 * @param {object} site - Site config for which integration should be used
 */
function applySystemIntegration (window, site) {
  if (AppConstants.platform === 'win') {
    WinTaskbar.setGroupIdForWindow(window, `filips.firefoxpwa.${site.ulid}`);
    setWindowIcons(window, site);
  }

  setWindowColors(window, site);
}
