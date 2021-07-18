XPCOMUtils.defineLazyModuleGetters(this, {
  hookFunction: 'resource://pwa/utils/hookFunction.jsm',
  xPref: 'resource://pwa/utils/xPref.jsm',
});

const ioService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);

//////////////////////////////
// Plans
//////////////////////////////

// Widgets
// TODO: For all widgets and UI elements - Localization of labels and tooltips
// TODO: For reader view, mute and tracking protection widgets - Add ability to just disable widget instead of hiding it (like "auto hide" for downloads)

// Windows
// TODO: New windows should still have access to gFFPWASiteConfig
// TODO: On Linux, all Firefox processes will have the same WM_CLASS, causing all PWAs to group together

// System integration
// TODO: Other system-related things specified in Web App Manifest

class PwaBrowser {
  constructor () {
    this.prepareLayout();

    if (!ChromeLoader.INITIALIZED_BROWSER) {
      this.prepareWidgets();
      this.configureAll();
    }
  }

  //////////////////////////////
  // Layout
  //////////////////////////////

  prepareLayout () {
    this.supportSmallWindowSizes();
    this.createInfoElements();
    this.createAddressInput();
    this.createNotificationAnchor();
    this.moveMenuButtons();
    this.switchPopupSides();
    this.makeUrlBarReadOnly();
    this.handleOutOfScopeNavigation();
    this.handleOpeningNewWindow();
    setTimeout(() => { this.handleTabsMode() });
    setTimeout(() => { this.handleLinkTargets() });
    setTimeout(() => { this.renameOpenImageAction() });
    setTimeout(() => { this.disableNewTabShortcuts() });
  }

  supportSmallWindowSizes () {
    document.getElementsByClassName('toolbar-items')[0].style.overflow = 'hidden';

    document.documentElement.style.minHeight = '0';
    document.documentElement.style.minWidth = '210px';
  }

  createInfoElements () {
    // Create favicon and title elements
    const siteInfo = this.createElement(document, 'hbox', { flex: 1, class: 'site-info', id: 'site-info' });

    const tabThrobber = this.createElement(document, 'hbox', { class: 'tab-throbber', layer: 'true', fadein: 'true' });
    siteInfo.append(tabThrobber);

    const tabIconImage = this.createElement(document, 'image', { class: 'tab-icon-image', role: 'presentation', fadein: 'true' });
    siteInfo.append(tabIconImage);

    const tabLabelContainer = this.createElement(document, 'hbox', { flex: 1, class: 'tab-label-container proton', onoverflow: 'this.setAttribute(\'textoverflow\', \'true\');', onunderflow: 'this.removeAttribute(\'textoverflow\');' });
    const tabLabel = this.createElement(document, 'label', { class: 'tab-text tab-label', role: 'presentation', fadein: 'true' });
    tabLabelContainer.append(tabLabel);
    siteInfo.append(tabLabelContainer);

    document.getElementById('TabsToolbar-customization-target').append(siteInfo);

    // Sync current tab favicon and title with custom info elements
    const browserTabs = document.getElementById('tabbrowser-tabs');

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.target.tagName !== 'tab') continue;
        if (!mutation.target.hasAttribute('selected')) continue;

        switch (mutation.attributeName) {
          case 'image':
            tabIconImage.setAttribute('src', mutation.target.getAttribute('image'));
            break;

          case 'label':
            tabLabel.replaceChildren(mutation.target.getAttribute('label'));
            document.title = mutation.target.getAttribute('label');
            break;

          case 'labeldirection':
            this.syncAttribute(mutation.target, tabLabelContainer, 'labeldirection');
            break;

          case 'busy':
          case 'pending':
          case 'pendingicon':
            this.syncAttribute(mutation.target, tabThrobber, mutation.attributeName);
            this.syncAttribute(mutation.target, tabIconImage, mutation.attributeName);
            break;

          case 'selected':
            tabIconImage.setAttribute('src', mutation.target.getAttribute('image'));
            tabLabel.replaceChildren(mutation.target.getAttribute('label'));
            break;
        }
      }
    });
    observer.observe(browserTabs, { attributes: true, subtree: true });
  }

  createAddressInput () {
    // Create custom URL input method via shortcut
    document.addEventListener('keydown', (event) => {
      if (event.key === 'F6') {
        event.preventDefault();

        const url = prompt('Enter site address');
        if (url) window.openTrustedLinkIn(url, 'current');
      }
    }, true);
  }

  createNotificationAnchor () {
    // Create new anchor element for action notifications
    BrowserPageActions.panelAnchorNodeForAction = () => {
      return document.getElementById('PanelUI-menu-button');
    };
  }

  moveMenuButtons () {
    // Do not move buttons if inside a popup window
    if (!window.toolbar.visible) return;

    // Move menu buttons
    const box = this.createElement(document, 'hbox');

    const navbarButton = document.getElementById('nav-bar-overflow-button');
    box.append(navbarButton);

    const appmenuButton = document.getElementById('PanelUI-menu-button');
    box.append(appmenuButton);

    document.getElementsByClassName('toolbar-items')[0].after(box);

    // Sync overflow-related attributes of navbar with tabsbar
    const tabsbar = document.getElementById('TabsToolbar');
    const navbar = document.getElementById('nav-bar');

    hookFunction(navbar, 'setAttribute', null, (_, [ name, value ]) => {
      if (name === 'nonemptyoverflow' || name === 'overflowing' || name === 'customizing') tabsbar.setAttribute(name, value);
    });

    hookFunction(navbar, 'removeAttribute', null, (_, [ name ]) => {
      if (name === 'nonemptyoverflow' || name === 'overflowing' || name === 'customizing') tabsbar.removeAttribute(name);
    });
  }

  switchPopupSides () {
    // Do this only once per window to prevent recursion
    if ('_openPopup' in PanelMultiView) return;

    // Switch popup sides for multiview panels if needed and handle tracking protection panel
    PanelMultiView._openPopup = PanelMultiView.openPopup;
    PanelMultiView.openPopup = async (...args) => {
      if (typeof args[2] === 'string') args[2] = { position: args[2] };

      if (args[2].position === 'bottomcenter topleft' && args[0].clientWidth + 50 < args[1].getBoundingClientRect().left) args[2].position = 'bottomcenter topright';
      else if (args[2].position === 'bottomcenter topright' && args[0].clientWidth + 50 > args[1].getBoundingClientRect().left) args[2].position = 'bottomcenter topleft';

      // If tracking protection panel is opened when widget is in menu, reassign anchor element
      if (args[1].id === 'tracking-protection-button' && args[1].trackingProtectionAreaType !== CustomizableUI.TYPE_TOOLBAR) {
        args[1] = document.getElementById('nav-bar-overflow-button');
      }

      return await PanelMultiView._openPopup(...args);
    }

    // Always switch popup sides for confirmation hints
    ConfirmationHint._panel._openPopup = ConfirmationHint._panel.openPopup;
    ConfirmationHint._panel.openPopup = async (...args) => {
      if (!args[1]) args[1] = {};
      if (typeof args[1] === 'object') args[1].position = 'bottomcenter topright';
      if (typeof args[1] === 'string') args[1] = 'bottomcenter topright';
      return await ConfirmationHint._panel._openPopup(...args);
    }
  }

  makeUrlBarReadOnly () {
    const originalToolbarVisibility = window.toolbar.visible;

    // This will lazily construct the URL bar and force it to be read-only
    window.toolbar.visible = false;
    window.gURLBar.readOnly = true;

    // Also un-focus the URL bar in case it is focused for some reason
    document.getElementById('urlbar').removeAttribute('focused');

    window.toolbar.visible = originalToolbarVisibility;
  }

  handleOutOfScopeNavigation () {
    hookFunction(window.gURLBar, 'setURI', null, (_, [uri]) => {
      const canLoad = this.canLoad(uri);
      let displayBar = !canLoad;

      // Open the default browser and close the current window if out of scope and user enabled that
      // Only do that for HTTP(S) and non-restricted domains because otherwise it is impossible to access certain parts of Firefox
      if (
        !canLoad &&
        xPref.get(ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER) &&
        (uri.scheme === 'http' || uri.scheme === 'https') &&
        !xPref.get(ChromeLoader.PREF_ALLOWED_DOMAINS).split(',').includes(uri.host) &&
        !xPref.get('extensions.webextensions.restrictedDomains').split(',').includes(uri.host)
      ) {
        MailIntegration._launchExternalUrl(makeURI(uri.spec));
        window.close();
        return;
      }

      // Change URL bar behaviour based on our custom preference
      const userPreference = xPref.get(ChromeLoader.PREF_DISPLAY_URL_BAR);
      if (userPreference === 1) displayBar = false;
      else if (userPreference === 2) displayBar = true;

      // Display URL bar when the website it out of scope
      document.getElementById('nav-bar').classList.toggle('shown', displayBar);
      window.gURLBar.updateLayoutBreakout();

      // Store the last in-scope URL so the close widget can return to it
      if (canLoad && uri && uri.spec !== 'about:blank') {
        window.gFFPWALastScopeUri = uri;
      }
    });
  }

  handleOpeningNewWindow () {
    // Handle opening new window from keyboard shortcuts
    window._openDialog = window.openDialog;
    window.openDialog = function (...args) {
      // Set the URL to the site homepage
      if (typeof args[3] === 'string' && (args[3] === 'about:home' || args[3] === 'about:privatebrowsing')) {
        args[3] = window.HomePage.get(window);
      }

      // Open a new window and set a site config
      const win = window._openDialog(...args);
      win.gFFPWASiteConfig = window.gFFPWASiteConfig;

      // Return a new window
      return win;
    };

    // Handle opening new window from context menus
    hookFunction(window, 'openContextMenu', null, () => {
      gContextMenu.openLink = function () {
        return window.openDialog(AppConstants.BROWSER_CHROME_URL, '_blank', 'chrome,all,dialog=no,non-private', this.linkURL);
      };
      gContextMenu.openLinkInPrivateWindow = function () {
        return window.openDialog(AppConstants.BROWSER_CHROME_URL, '_blank', 'chrome,all,dialog=no,private', this.linkURL);
      };
    });
  }

  handleTabsMode () {
    // Enable tabs mode if needed
    const tabsModeEnabled = xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE);
    document.documentElement.toggleAttribute('tabsmode', tabsModeEnabled);

    // Set new tab URL to site start URL
    let userStartUrl = window.gFFPWASiteConfig.config.start_url;
    let manifestStartUrl = window.gFFPWASiteConfig.manifest.start_url;
    window.AboutNewTab.newTabURL = userStartUrl ? userStartUrl : manifestStartUrl;

    // Do not treat new tab URL as an initial and a blank page
    // This is needed to prevent breaking start URL identity widget and URL display
    window.isInitialPage = function (url) {
      if (!(url instanceof Ci.nsIURI)) {
        try { url = Services.io.newURI(url) }
        catch (ex) { return false }
      }

      let nonQuery = url.prePath + url.filePath;
      return gInitialPages.includes(nonQuery);
    };

    window.isBlankPageURL = function (url) {
      return url === 'about:blank' || url === 'about:home' || url === 'about:welcome';
    };
  }

  handleLinkTargets () {
    // Overwrite built-in preference based on our custom preference
    // Links target overwrites need to be disabled when tab mode is enabled
    const userPreference = xPref.get(ChromeLoader.PREF_LINKS_TARGET);
    if (!userPreference || xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE)) return;
    xPref.set('browser.link.open_newwindow', userPreference);

    // Overwrite tab adding and instead open it in the same tab
    // Except if it was called from customize mode enter
    window.gBrowser._addTab = window.gBrowser.addTab
    window.gBrowser.addTab = function (url, params = {}) {
      if (gCustomizeMode._wantToBeInCustomizeMode || gCustomizeMode._customizing) {
        return window.gBrowser._addTab(url, params);
      }

      window.openLinkIn(url, userPreference === 1 ? 'current' : 'window', params);
      return window.gBrowser.selectedTab;
    }

    // Force open link in the same tab if it wanted to be opened in a new tab
    window._openLinkIn = window.openLinkIn;
    window.openLinkIn = function (url, where, params = {}) {
      if (where === 'tab' || where === 'tabshifted') {
        if (userPreference === 1) where = 'current';
        else if (userPreference === 2) where = 'window';
      }

      return window._openLinkIn(url, where, params);
    }
  }

  renameOpenImageAction () {
    // Rename open/view image context menu action based on links target preference
    // Links target overwrites need to be disabled when tab mode is enabled
    const userPreference = xPref.get(ChromeLoader.PREF_LINKS_TARGET);
    if (!userPreference || xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE)) return;

    let actionLabel;
    if (userPreference === 1) actionLabel = 'Open Image';
    else if (userPreference === 2) actionLabel = 'Open Image in New Window';

    document.getElementById('context-viewimage').setAttribute('label', actionLabel);
  }

  disableNewTabShortcuts () {
    // New tab shortcuts are useless when tabs mode is disabled
    if (!xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE)) {
      document.getElementById('cmd_newNavigatorTab').remove();
      document.getElementById('cmd_newNavigatorTabNoEvent').remove();
    }
  }

  //////////////////////////////
  // Widgets
  //////////////////////////////

  prepareWidgets () {
    this.createReaderViewWidget();
    this.createCopyLinkWidget();
    this.createShareWidget();
    this.createSendToDeviceWidget();
    this.createOpenInBrowserWidget();
    this.createMuteWidget();
    this.createTrackingProtectionWidget();
    this.createIdentityInformationWidget();
    this.createPermissionsWidget();
    this.createNotificationsWidget();
    this.createCloseWidget();
    this.modifyHomepageWidget();
  }

  createReaderViewWidget () {
    let readerViewAreaType;

    // Create reader view widget
    CustomizableUI.createWidget({
      id: 'reader-view-button',
      type: 'button',

      label: 'Reader View',
      tooltiptext: 'Toggle a reader view',

      onCreated (node) {
        if (
          CustomizableUI.getAreaType(this.currentArea) !== CustomizableUI.TYPE_MENU_PANEL &&
          !(gCustomizeMode._wantToBeInCustomizeMode || gCustomizeMode._customizing)
        ) {
          node.hidden = true;
        }

        // Store and update current widget area
        readerViewAreaType = CustomizableUI.getAreaType(this.currentArea);

        let listener = {
          onWidgetAdded: (widget, area) => {
            if (widget !== this.id) return;
            readerViewAreaType = CustomizableUI.getAreaType(area);
          },
          onWidgetMoved: (widget, area) => {
            if (widget !== this.id) return;
            readerViewAreaType = CustomizableUI.getAreaType(area);
          },
          onWidgetRemoved: (widget) => {
            if (widget !== this.id) return;
            readerViewAreaType = undefined;
          },
          onWidgetInstanceRemoved: (widget, doc) => {
            if (widget !== this.id || doc !== document) return;

            CustomizableUI.removeListener(listener);
            readerViewAreaType = undefined;
          },
        };
        CustomizableUI.addListener(listener);
      },
      onClick (event) {
        if (!event.target.disabled) AboutReaderParent.buttonClick(event);
      }
    });

    // Hide reader view view widget when page does not contain article, except when in customize mode
    hookFunction(AboutReaderParent.prototype, 'updateReaderButton', null, (_, [ browser ]) => {
      const readerViewButton = browser.ownerDocument.getElementById('reader-view-button');
      const readerViewOriginal = browser.ownerDocument.getElementById('reader-mode-button');

      if (!readerViewButton) return;

      if (gCustomizeMode._wantToBeInCustomizeMode || gCustomizeMode._customizing) {
        readerViewButton.hidden = false;
        readerViewButton.disabled = false;

        readerViewButton.removeAttribute('readeractive');
      } else {
        if (readerViewAreaType === CustomizableUI.TYPE_TOOLBAR) readerViewButton.hidden = readerViewOriginal.hidden;
        else readerViewButton.disabled = readerViewOriginal.hidden;

        if (readerViewOriginal.getAttribute('readeractive')) {
          readerViewButton.setAttribute('readeractive', 'true');
        } else {
          readerViewButton.removeAttribute('readeractive');
        }
      }
    });
  }

  createCopyLinkWidget () {
    // Create copy link widget
    CustomizableUI.createWidget({
      id: 'copy-link-button',
      type: 'button',

      label: 'Copy Link',
      tooltiptext: 'Copy a link to this page',

      onClick (event) {
          event.target.ownerGlobal.BrowserPageActions.copyURL.onCommand(event, event.target);
      }
    });
  }

  createShareWidget () {
    // Create share widget for macOS
    if (AppConstants.platform === 'macosx') {
      CustomizableUI.createWidget({
        id: 'share-link-button',
        viewId: 'share-link-view',
        type: 'view',

        label: 'Share Link',
        tooltiptext: 'Share a link to this page',

        onBeforeCreated: (document) => {
          const viewCache = document.getElementById('appMenu-viewCache');
          const shareLinkView = this.createElement(document, 'panelview', { id: 'share-link-view', flex: 1 });
          const subviewBody = this.createElement(document, 'vbox', { class: 'panel-subview-body' });

          shareLinkView.append(subviewBody);
          viewCache.append(shareLinkView);
        },
        onCreated (node) {
          node.classList.add('subviewbutton-nav');
        },
        onViewShowing (event) {
          event.detail.addBlocker((async () => {
            const document = event.target.ownerDocument;
            const window = event.target.ownerGlobal;

            window.BrowserPageActions.shareURL.onShowingInPanel();
            window.BrowserPageActions.shareURL.onShowingSubview(document.getElementById('share-link-view'));

            return true;
          })());
        }
      });
    }

    // Create share widget for Windows
    if (AppConstants.isPlatformAndVersionAtLeast('win', '6.4')) {
      CustomizableUI.createWidget({
        id: 'share-link-button',
        type: 'button',

        label: 'Share Link',
        tooltiptext: 'Share a link to this page',

        onClick (event) {
            event.target.ownerGlobal.BrowserPageActions.shareURL.onCommand(event, event.target);
        }
      });
    }
  }

  createSendToDeviceWidget () {
    // Create send to device widget if Firefox account is enabled
    if (xPref.get('identity.fxaccounts.enabled')) {
      CustomizableUI.createWidget({
        id: 'send-to-device-button',
        viewId: 'send-to-device-view',
        type: 'view',

        label: 'Send to Device',
        tooltiptext: 'Send this page to another device',

        onBeforeCreated: (document) => {
          const viewCache = document.getElementById('appMenu-viewCache');
          const shareLinkView = this.createElement(document, 'panelview', { id: 'send-to-device-view', flex: 1 });
          const subviewBody = this.createElement(document, 'vbox', { class: 'panel-subview-body' });

          shareLinkView.append(subviewBody);
          viewCache.append(shareLinkView);
        },
        onCreated (node) {
          node.classList.add('subviewbutton-nav');
        },
        onViewShowing (event) {
          event.detail.addBlocker((async () => {
            const window = event.target.ownerGlobal;
            const document = event.target.ownerDocument;
            const view = document.getElementById('send-to-device-view');

            view.getElementsByClassName('panel-subview-body')[0].innerHTML = '';

            window.BrowserPageActions.sendToDevice.onSubviewPlaced(view);
            window.BrowserPageActions.sendToDevice.onShowingSubview(view);

            return true;
          })());
        }
      });
    }
  }

  createOpenInBrowserWidget () {
    // Create open in browser widget
    CustomizableUI.createWidget({
      id: 'open-in-browser-button',
      type: 'button',

      label: 'Open in Browser',
      tooltiptext: 'Open this page in browser',

      onClick (event) {
        // "Abusing" mail integration to open current URL in external browser
        MailIntegration._launchExternalUrl(makeURI(gURLBar.makeURIReadable(event.target.ownerGlobal.gBrowser.selectedBrowser.currentURI).displaySpec));
      }
    });
  }

  createMuteWidget () {
    // Create mute page widget
    CustomizableUI.createWidget({
      id: 'mute-button',
      type: 'button',

      label: 'Toogle Sound',
      tooltiptext: 'Toggle page sound',

      onCreated (node) {
        const document = node.ownerDocument;
        const window = document.defaultView;

        // Store and update current widget area
        let muteWidgetAreaType = CustomizableUI.getAreaType(this.currentArea);

        let listener = {
          onWidgetAdded: (widget, area) => {
            if (widget !== this.id) return;
            muteWidgetAreaType = CustomizableUI.getAreaType(area);
          },
          onWidgetMoved: (widget, area) => {
            if (widget !== this.id) return;
            muteWidgetAreaType = CustomizableUI.getAreaType(area);
          },
          onWidgetRemoved: (widget) => {
            if (widget !== this.id) return;
            muteWidgetAreaType = undefined;
          },
          onWidgetInstanceRemoved: (widget, doc) => {
            if (widget !== this.id || doc !== document) return;

            CustomizableUI.removeListener(listener);
            muteWidgetAreaType = undefined;
          },
        };
        CustomizableUI.addListener(listener);

        // Force show widget on customize mode page and reset its state
        hookFunction(window.gCustomizeMode, 'enter', null, () => {
          node.setAttribute('playing', 'true');
          node.removeAttribute('muted');
          node.hidden = false;
        });

        // Add audio playback hooks for every tab
        let hookPlaybackStatus = () => {
          const browser = window.gBrowser.selectedBrowser;
          const tab = window.gBrowser.selectedTab;

          // Force show widget on customize mode page and reset its state
          if (document.getElementById('main-window').getAttribute('customizing')) {
            node.setAttribute('playing', 'true');
            node.removeAttribute('muted');
            node.hidden = false;
            return;
          }

          // Update when switching tabs
          if (tab.hasAttribute('soundplaying')) {
            node.setAttribute('playing', 'true');
            node.hidden = false;
          } else {
            if (muteWidgetAreaType === CustomizableUI.TYPE_TOOLBAR) {
              node.removeAttribute('playing');
              if (!browser.audioMuted) node.hidden = true;
            }
          }

          if (browser.audioMuted) {
            node.setAttribute('muted', 'true');
            node.hidden = false;
          } else {
            node.removeAttribute('muted');
            if (!node.hasAttribute('playing')) node.hidden = true;
          }

          if ('_pwaPlaybackHooks' in browser) return;
          browser._pwaPlaybackHooks = true;

          // Create hooks when starting/stopping/muting audio
          hookFunction(browser, 'audioPlaybackStarted', () => {
            node.setAttribute('playing', 'true');
            node.hidden = false;
          });

          hookFunction(browser, 'audioPlaybackStopped', () => {
            setTimeout(() => {
              if (muteWidgetAreaType === CustomizableUI.TYPE_TOOLBAR && (!tab.hasAttribute('soundplaying') || tab.hasAttribute('soundplaying-scheduledremoval'))) {
                node.removeAttribute('playing');
                if (!browser.audioMuted) node.hidden = true;
              }
            }, 1000);
          });

          hookFunction(tab, 'toggleMuteAudio', null, () => {
            if (browser.audioMuted) {
              node.setAttribute('muted', 'true');
              node.hidden = false;
            } else {
              node.removeAttribute('muted');
              if (!node.hasAttribute('playing')) node.hidden = true;
            }
          });
        }

        hookPlaybackStatus();
        hookFunction(window.gBrowser, 'updateCurrentBrowser', null, hookPlaybackStatus);

        // Hide it by default when in toolbar, otherwise always show playing icon
        if (muteWidgetAreaType === CustomizableUI.TYPE_TOOLBAR) {
          node.hidden = true;
        } else {
          node.setAttribute('playing', 'true');
          node.hidden = false;
        }
      },
      onClick (event) {
          event.target.ownerGlobal.gBrowser.selectedTab.toggleMuteAudio();
      }
    });
  }

  createTrackingProtectionWidget () {
    // Create tracking protection widget
    CustomizableUI.createWidget({
      id: 'tracking-protection-button',
      type: 'button',

      label: 'Tracking Protection',
      tooltiptext: 'View information about tracking protection on this site',

      onCreated (node) {
        const document = node.ownerDocument;
        const window = document.defaultView;

        Object.defineProperty(window.gProtectionsHandler, '_trackingProtectionIconContainer', { get: () => node });

        // Store and update current widget area
        node.trackingProtectionAreaType = CustomizableUI.getAreaType(this.currentArea);

        let listener = {
          onWidgetAdded: (widget, area) => {
            if (widget !== this.id) return;
            node.trackingProtectionAreaType = CustomizableUI.getAreaType(area);
          },
          onWidgetMoved: (widget, area) => {
            if (widget !== this.id) return;
            node.trackingProtectionAreaType = CustomizableUI.getAreaType(area);
          },
          onWidgetRemoved: (widget) => {
            if (widget !== this.id) return;
            node.trackingProtectionAreaType = undefined;
          },
          onWidgetInstanceRemoved: (widget, doc) => {
            if (widget !== this.id || doc !== document) return;

            CustomizableUI.removeListener(listener);
            node.trackingProtectionAreaType = undefined;
          },
        };
        CustomizableUI.addListener(listener);

        // Update widget icon and tooltip when needed
        hookFunction(window.gProtectionsHandler, 'showDisabledTooltipForTPIcon', null, function () {
          node.setAttribute('tooltiptext', this.strings.disabledTooltipText.replace(/\.$/, ''));
        });

        hookFunction(window.gProtectionsHandler, 'showActiveTooltipForTPIcon', null, function () {
          node.setAttribute('tooltiptext', this.strings.activeTooltipText.replace(/\.$/, ''));
        });

        hookFunction(window.gProtectionsHandler, 'showNoTrackerTooltipForTPIcon', null, function () {
          node.setAttribute('tooltiptext', this.strings.noTrackerTooltipText.replace(/\.$/, ''));
        });

        // Force show widget on customize mode page and reset its state
        hookFunction(window.gCustomizeMode, 'enter', null, () => {
          window.gProtectionsHandler._trackingProtectionIconContainer.hidden = false;

          node.getElementsByClassName('toolbarbutton-icon')[0].removeAttribute('hasException');
          node.getElementsByClassName('toolbarbutton-icon')[0].removeAttribute('active');
        });

        // Force show widget if not in toolbar
        hookFunction(window.gProtectionsHandler, 'onLocationChange', null, () => {
          if (node.trackingProtectionAreaType === CustomizableUI.TYPE_TOOLBAR) {
            node.disabled = false;
            return;
          }

          if (node.hidden) {
            node.hidden = false;
            node.disabled = true;
          } else {
            node.disabled = false;
          }
        });

        // Sync attributes from old icon to the new one
        hookFunction(document.getElementById('tracking-protection-icon-box'), 'toggleAttribute', null, (_, [ name, force = false ]) => {
          const protectionButton = node.getElementsByClassName('toolbarbutton-icon')[0];
          if (protectionButton) protectionButton.toggleAttribute(name, force);
        });

        // Unselect button when panel closes
        hookFunction(window.gProtectionsHandler, '_initializePopup', null, function () {
          hookFunction(this._protectionsPopup, 'on_popuphiding', null, () => {
            node.removeAttribute('open');
          });
        });
      },
      onClick (event) {
        if (!event.target.disabled) event.target.ownerGlobal.gProtectionsHandler.handleProtectionsButtonEvent(event);
      }
    });
  }

  createIdentityInformationWidget () {
    // Create identity information widget
    CustomizableUI.createWidget({
      id: 'identity-button',
      type: 'button',

      label: 'Site Information',
      tooltiptext: 'View information about this site',

      removable: false,
      overflows: false,
      defaultArea: CustomizableUI.AREA_TABSTRIP,

      onCreated (node) {
        const document = node.ownerDocument;
        const window = document.defaultView;

        // Do not override identity widget box if inside a popup window
        if (!window.toolbar.visible) return;

        Object.defineProperty(window.gIdentityHandler, '_identityIconBox', { get: () => node });
        let defaultTooltip = node.getAttribute('tooltiptext');

        // Sync attributes from old icon to the new one and update tooltip
        hookFunction(document.getElementById('identity-icon'), 'setAttribute', null, (_, [ name, value ]) => {
          if (name === 'tooltiptext') {
            if (value) node.setAttribute(name, value);
            else node.setAttribute(name, defaultTooltip);
          }

          const identityIcon = node.getElementsByClassName('toolbarbutton-icon')[0];
          identityIcon.className = 'toolbarbutton-icon ' + document.getElementById('identity-box').className;
        });

        hookFunction(document.getElementById('identity-box'), 'setAttribute', null, () => {
          const identityIcon = node.getElementsByClassName('toolbarbutton-icon')[0];
          identityIcon.setAttribute('pageproxystate', document.getElementById('identity-box').getAttribute('pageproxystate'));
        });
      },
      onClick (event) {
          event.target.ownerGlobal.gIdentityHandler.handleIdentityButtonEvent(event);
      }
    });
  }

  createPermissionsWidget () {
    // Create permissions widget
    CustomizableUI.createWidget({
      id: 'permissions-button',
      type: 'button',

      label: 'Site Permissions',
      tooltiptext: 'View permissions granted to this site',

      removable: false,
      overflows: false,
      defaultArea: CustomizableUI.AREA_TABSTRIP,

      onCreated: (node) => {
        const document = node.ownerDocument;
        const window = document.defaultView;

        const permissionBox = document.getElementById('identity-permission-box');
        permissionBox.classList.add('toolbarbutton-icon');

        // Reverse permissions icons
        node.addEventListener('DOMNodeInserted', (event) => {
          if (event.target.tagName === 'image' && event.target.className === 'toolbarbutton-icon') {
            event.target.replaceWith(permissionBox);
            this.reverseChildren(permissionBox);
          }
        }, { capture: true, passive: true });

        // Update permissions button
        let updatePermissionsButton = () => {
          const permissionButton = document.getElementById('permissions-button');
          const permissionBox = gPermissionPanel._identityPermissionBox;

          const isDisplayed = permissionBox.hasAttribute('hasPermissions') || permissionBox.hasAttribute('hasSharingIcon');

          if (isDisplayed) permissionButton.removeAttribute('hidden');
          else permissionButton.setAttribute('hidden', 'true');
        };

        hookFunction(window.gPermissionPanel, 'refreshPermissionIcons', null, updatePermissionsButton);
        hookFunction(window.gPermissionPanel, 'updateSharingIndicator', null, updatePermissionsButton);

        // Show permissions widget on customize mode page
        hookFunction(window.gCustomizeMode, 'enter', null, () => {
          node.setAttribute('customizing', 'true');
        });

        hookFunction(window.gCustomizeMode, 'exit', null, () => {
          node.removeAttribute('customizing');
        });
      },
      onClick (event) {
          event.target.ownerGlobal.gPermissionPanel.handleIdentityButtonEvent(event);
      }
    });
  }

  createNotificationsWidget () {
    // Create notifications widget
    CustomizableUI.createWidget({
      id: 'notifications-button',
      type: 'button',

      label: 'Site Notifications',
      tooltiptext: 'Popup notifications for this site',

      removable: false,
      overflows: false,
      defaultArea: CustomizableUI.AREA_TABSTRIP,

      onCreated: (node) => {
        const document = node.ownerDocument;
        const window = document.defaultView;

        let defaultTooltip = node.getAttribute('tooltiptext');

        const notificationsBox = document.getElementById('notification-popup-box');
        notificationsBox.classList.add('toolbarbutton-icon');

        // Reverse permissions icons
        node.addEventListener('DOMNodeInserted', (event) => {
          if (event.target.tagName === 'image' && event.target.className === 'toolbarbutton-icon') {
            event.target.replaceWith(notificationsBox);
            this.reverseChildren(notificationsBox);
          }
        }, { capture: true, passive: true });

        // Show panel when needed
        hookFunction(window.PopupNotifications, '_showPanel', () => {
          node.setAttribute('highlighted', true);
          node.removeAttribute('hidden');
        });

        // Sync attributes and icons
        hookFunction(window.PopupNotifications, '_showIcons', null, () => {
          for (const icon of document.getElementById('notification-popup-box').childNodes) {
            if (icon.getAttribute('showing')) {
              node.setAttribute('tooltiptext', icon.getAttribute('tooltiptext'));
              return;
            }
          }

          node.setAttribute('tooltiptext', defaultTooltip);
        });

        hookFunction(window.PopupNotifications, '_hideIcons', null, () => {
          node.removeAttribute('highlighted');
          node.setAttribute('hidden', true);
        });

        // Switch popup sides for popup notifications if needed
        if (!('_openPopup' in window.PopupNotifications.panel)) {
          window.PopupNotifications.panel._openPopup = window.PopupNotifications.panel.openPopup;
          window.PopupNotifications.panel.openPopup = async (...args) => {
            if (!args[1]) args[1] = {};

            if (args[0].getBoundingClientRect().left < 500) {
              if (typeof args[1] === 'object') args[1].position = 'bottomcenter topleft';
              if (typeof args[1] === 'string') args[1] = 'bottomcenter topleft';
            } else {
              if (typeof args[1] === 'object') args[1].position = 'bottomcenter topright';
              if (typeof args[1] === 'string') args[1] = 'bottomcenter topright';
            }

            return await window.PopupNotifications.panel._openPopup(...args);
          };
        }

        // Show notifications widget on customize mode page
        hookFunction(window.gCustomizeMode, 'enter', null, () => {
          node.setAttribute('customizing', 'true');
        });

        hookFunction(window.gCustomizeMode, 'exit', null, () => {
          node.removeAttribute('customizing');
        });

        // Disable and hide it by default
        node.disabled = true;
        node.hidden = true;
      }
    });
  }

  createCloseWidget () {
    // Create close page widget
    CustomizableUI.createWidget({
      id: 'close-page-button',
      type: 'button',

      label: 'Close',
      tooltiptext: 'Close the current page',

      removable: false,
      overflows: false,
      defaultArea: CustomizableUI.AREA_NAVBAR,

      onClick (event) {
        const window = event.target.ownerGlobal;

        if (window.gFFPWALastScopeUri) {
          window.openWebLinkIn(gFFPWALastScopeUri.spec, 'current');
        } else {
          window.close();
        }
      }
    });
  }

  modifyHomepageWidget () {
    window.HomePage._get = window.HomePage.get;
    window.HomePage.get = function (window) {
      if (!window || !window.gFFPWASiteConfig) return this._get(window);

      // Use user-specified start URL if it exists, otherwise use manifest-specified start URL
      let userStartUrl = window.gFFPWASiteConfig.config.start_url;
      let manifestStartUrl = window.gFFPWASiteConfig.manifest.start_url;
      return userStartUrl ? userStartUrl : manifestStartUrl;
    };

    hookFunction(window, 'onload', null, () => {
      try {
        this.modifyWidget('home-button', { tooltiptext: 'App Start Page' });
      } catch (_) {}
    });
  }

  //////////////////////////////
  // Configuration
  //////////////////////////////

  configureAll () {
    this.configureLayout();
    this.configureWidgets();
    this.configureSettings();
  }

  configureLayout () {
    // Configure default layout
    let { gAreas } = Cu.import('resource:///modules/CustomizableUI.jsm');
    gAreas.get(CustomizableUI.AREA_NAVBAR).set('defaultPlacements', ['close-page-button', 'back-button', 'forward-button', 'urlbar-container']);
    gAreas.get(CustomizableUI.AREA_TABSTRIP).set('defaultPlacements', ['site-info', 'tabbrowser-tabs', 'new-tab-button', 'alltabs-button', 'mute-button', 'notifications-button', 'permissions-button', 'downloads-button', 'tracking-protection-button', 'identity-button']);
    gAreas.get(CustomizableUI.AREA_BOOKMARKS).set('defaultCollapsed', 'never');
  }

  configureWidgets () {
    // Make more widgets removable
    // Currently disabled because Firefox crashes when back and forward buttons don't exist
    // this.modifyWidget('back-button', { removable: true });
    // this.modifyWidget('forward-button', { removable: true });

    // Make extensions widgets go to tab strip area by default
    const { BrowserActionBase } = ChromeUtils.import('resource://gre/modules/ExtensionActions.jsm');
    hookFunction(BrowserActionBase.prototype, 'getDefaultArea', null, function () {
      return this.globals.default_area === 'navbar' ? 'tabstrip' : this.globals.default_area;
    })
  }

  configureSettings () {
    // Configure default built-in preferences
    xPref.set('browser.toolbars.bookmarks.visibility', 'never', true);
    xPref.set('browser.taskbar.lists.enabled', false, true);
    xPref.set('browser.tabs.extraDragSpace', false, true);
    xPref.set('browser.tabs.warnOnClose', false, true);
    xPref.set('browser.shell.checkDefaultBrowser', false, true);
    xPref.set('browser.uidensity', 1, true);
    xPref.set('browser.link.open_newwindow', 1, true);

    // Set distribution details
    xPref.set('distribution.id', ChromeLoader.DISTRIBUTION_ID, true);
    xPref.set('distribution.version', ChromeLoader.DISTRIBUTION_VERSION, true);
    xPref.set('distribution.about', ChromeLoader.DISTRIBUTION_ABOUT, true);

    // Determines whether `_blank` links target is forced into the current tab or a new window
    // 0 - Do not change link behaviour (strongly not recommended)
    // 1 - Force links into the current tab (default)
    // 2 - Force links into a new window
    xPref.set(ChromeLoader.PREF_LINKS_TARGET, 1, true);

    // Determines whether URL bar is displayed always, when out of scope or never
    // 0 - Display URL bar when out of scope (default)
    // 1 - Never display URL bar (strongly not recommended)
    // 2 - Always display URL bar
    xPref.set(ChromeLoader.PREF_DISPLAY_URL_BAR, 0, true);

    // Determines whether the sites can override theme (titlebar) color
    xPref.set(ChromeLoader.PREF_SITES_SET_THEME_COLOR, true, true);

    // Determines whether the sites can override background color
    xPref.set(ChromeLoader.PREF_SITES_SET_BACKGROUND_COLOR, true, true);

    // Determines whether out of scope URLs should be opened in a default browser
    xPref.set(ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER, false, true);

    // Determines whether the tabs mode is enabled
    xPref.set(ChromeLoader.PREF_ENABLE_TABS_MODE, false, true);

    // Determines which domains should always be allowed to open in the PWA browser
    // This is a comma-separated list of domains
    xPref.set(ChromeLoader.PREF_ALLOWED_DOMAINS, '', true);
  }

  //////////////////////////////
  // Utils
  //////////////////////////////

  /**
   * @param {Document} document
   * @param {string} tag
   * @param {object} [attributes]
   * @param {boolean} [XUL]
   *
   * @returns HTMLElement
   */
  createElement (document, tag, attributes = {}, XUL = true) {
    let element = XUL ? document.createXULElement(tag) : document.createElement(tag);

    for (let attribute in attributes) {
      element.setAttribute(attribute, attributes[attribute]);
    }

    return element;
  }

  /**
   * @param {HTMLElement} parent
   */
  reverseChildren (parent) {
    let children = parent.childNodes.length;
    while (children--) parent.appendChild(parent.childNodes[children]);
  }

  /**
   * @param {HTMLElement} source
   * @param {HTMLElement} target
   * @param {string} attribute
   */
  syncAttribute(source, target, attribute) {
    if (!source.hasAttribute(attribute)) target.removeAttribute(attribute);
    else target.setAttribute(attribute, source.getAttribute(attribute));
  }

  /**
   * @param {string} widgetId
   */
  destroyWidget (widgetId) {
    CustomizableUI.removeWidgetFromArea(widgetId);
    CustomizableUI.destroyWidget(widgetId);
    document.getElementById(widgetId).remove();
  }

  /**
   * @param {string} widgetId
   * @param {object} [attributes]
   *
   * @returns {HTMLElement}
   */
  modifyWidget (widgetId, attributes = {}) {
    let element = document.getElementById(widgetId);

    for (let attribute in attributes) {
      element.setAttribute(attribute, attributes[attribute]);
    }

    return element;
  }

  /**
   * Checks whether the given URI is considered to be a part the current PWA or not.
   *
   * This checks whether a manifest's scope includes the given URI according to
   * the W3C specification. It also always allows loading `about:blank` as it
   * is the initial page for iframes.
   *
   * Any URIs that return false should be loaded with an out-of-scope URL bar.
   *
   * @param {nsIURI} uri The URI to check.
   *
   * @returns {boolean} Whether this PWA can load the URI.
   */
  canLoad (uri) {
    if (!uri || uri.spec === 'about:blank') return true;
    if (!window.gFFPWASiteConfig) return false;

    const scope = ioService.newURI(window.gFFPWASiteConfig.manifest.scope);

    if (scope.prePath !== uri.prePath) return false;
    return uri.filePath.startsWith(scope.filePath);
  }
}

new PwaBrowser();
