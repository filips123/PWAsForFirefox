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

/**
 * Apply system integration to the provided window for the provided PWA site.
 *
 * This function sets the AppUserModelID (GroupID) property of the window,
 * allowing grouping multiple windows of the same site in the Windows taskbar
 * and preventing grouping different sites. It also sets taskbar windows icons
 * to prevent incorrect behaviour when pinning/unpinning the shortcut.
 *
 * @param {ChromeWindow} window - Window where integration should be applied
 * @param {object} site - Site config for which integration should be used
 */
function applySystemIntegration (window, site) {
  if (AppConstants.platform === 'win') {
    WinTaskbar.setGroupIdForWindow(window, `filips.firefoxpwa.${site.ulid}`);
    setWindowIcons(window, site);
  }
}
