XPCOMUtils.defineLazyModuleGetters(this, {
  applyDynamicThemeColor: 'resource://pwa/utils/systemIntegration.jsm',
  buildIconList: 'resource://pwa/utils/systemIntegration.jsm',
  sendNativeMessage: 'resource://pwa/utils/nativeMessaging.jsm',
  hookFunction: 'resource://pwa/utils/hookFunction.jsm',
  xPref: 'resource://pwa/utils/xPref.jsm',
});
XPCOMUtils.defineLazyServiceGetter(this, 'ioService', '@mozilla.org/network/io-service;1', Ci.nsIIOService);
XPCOMUtils.defineLazyServiceGetter(this, 'WindowsUIUtils', '@mozilla.org/windows-ui-utils;1', Ci.nsIWindowsUIUtils);

class PwaBrowser {
  constructor () {
    if (!ChromeLoader.INITIALIZED_BROWSER) {
      this.prepareWidgets();
      this.configureAll();
    }

    this.prepareLayout();
  }

  //////////////////////////////
  // Layout
  //////////////////////////////

  prepareLayout () {
    this.supportSmallWindowSizes();
    this.createInfoElements();
    this.createAddressInput();
    this.createNotificationAnchor();
    this.createOpenInBrowserMenuItem();
    this.createOpenDefaultBrowserShortcut();
    this.moveMenuButtons();
    this.switchPopupSides();
    this.makeUrlBarReadOnly();
    this.handleRegisteringProtocols();
    this.handleOutOfScopeNavigation();
    this.handleOpeningNewWindow();
    setTimeout(() => { this.handleHiddenTitlebar() });
    setTimeout(() => { this.handleTabsMode() });
    setTimeout(() => { this.handleLinkTargets() });
    setTimeout(() => { this.handleDynamicThemeColor() });
    setTimeout(() => { this.renameOpenImageAction() });
    setTimeout(() => { this.disableNewTabShortcuts() });
    this.renameHomepageWidget();
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

    // Set initial favicon and title to the site's static info
    const siteIcons = buildIconList(window.gFFPWASiteConfig?.manifest.icons || []);
    const siteIcon = siteIcons.find(icon => icon.size >= 32) || siteIcons[siteIcons.length - 1];
    if (siteIcon) tabIconImage.setAttribute('src', siteIcon.icon.src);

    const siteName = window.gFFPWASiteConfig?.config.name || window.gFFPWASiteConfig?.manifest.name || window.gFFPWASiteConfig?.manifest.short_name
    tabLabel.replaceChildren(siteName);
    document.title = siteName;

    // Sync current tab favicon and title with custom info elements
    // This can be disabled by user using our preferences
    const docDS = document.documentElement.dataset;
    docDS['contentTitleDefault'] = docDS['contentTitlePrivate'] = 'CONTENTTITLE'
    docDS['titleDefault'] = docDS['titlePrivate'] = siteName

    window.gBrowser.updateTitlebar = function () {
      const dynamicTitle = xPref.get(ChromeLoader.PREF_DYNAMIC_WINDOW_TITLE);
      if (dynamicTitle) document.title = this.getWindowTitleForBrowser(this.selectedBrowser);
    };

    function updateNameAndIcon (source) {
      const dynamicIcon = xPref.get(ChromeLoader.PREF_DYNAMIC_WINDOW_ICON);
      if (dynamicIcon) tabIconImage.setAttribute('src', source.getAttribute('image'));

      const dynamicTitle = xPref.get(ChromeLoader.PREF_DYNAMIC_WINDOW_TITLE);
      if (dynamicTitle) tabLabel.replaceChildren(source.getAttribute('label'));
      else tabLabel.replaceChildren(siteName);
    }

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.target.tagName !== 'tab') continue;
        if (!mutation.target.hasAttribute('selected')) continue;

        switch (mutation.attributeName) {
          case 'image':
            updateNameAndIcon(mutation.target);
            break;

          case 'label':
            updateNameAndIcon(mutation.target);
            break;

          case 'labeldirection':
            const dynamicTitle = xPref.get(ChromeLoader.PREF_DYNAMIC_WINDOW_TITLE);
            if (dynamicTitle) this.syncAttribute(mutation.target, tabLabelContainer, 'labeldirection');
            break;

          case 'busy':
          case 'pending':
          case 'pendingicon':
            this.syncAttribute(mutation.target, tabThrobber, mutation.attributeName);
            this.syncAttribute(mutation.target, tabIconImage, mutation.attributeName);
            break;

          case 'selected':
            updateNameAndIcon(mutation.target);
            break;
        }
      }
    });

    observer.observe(
      document.getElementById('tabbrowser-tabs'),
      { attributes: true, subtree: true }
    );
  }

  createAddressInput () {
    // Create a custom URL input method via shortcut
    function addressInputHandle () {
      const url = prompt('Enter site address');
      if (url) window.openTrustedLinkIn(url, 'current');
    }

    // Handle opening with F6
    document.addEventListener('keydown', (event) => {
      if (event.key === 'F6') {
        event.preventDefault();
        addressInputHandle();
      }
    }, true);

    // Handle opening with Ctrl+L and Alt+D
    document.getElementById('Browser:OpenLocation').setAttribute(
      'oncommand',
      '(' + addressInputHandle.toString() + ')()'
    );
  }

  createNotificationAnchor () {
    // Create new anchor element for action notifications
    BrowserPageActions.panelAnchorNodeForAction = () => {
      return document.getElementById('PanelUI-menu-button');
    };
  }

  createOpenInBrowserMenuItem () {
    // Remap access key for opening new window to "N"
    document.getElementById('context-openlink').accessKey = 'N';

    // Create context menu item that opens link in a default browser
    const menuItem = this.createElement(document, 'menuitem', { id: 'contextmenu-openlinkdefault', label: 'Open Link in Default Browser', accesskey: 'D', oncommand: 'gContextMenu.openLinkInDefaultBrowser()' });
    document.getElementById('context-sep-open').before(menuItem)

    hookFunction(window, 'openContextMenu', null, () => {
      // Display it only when clicked on links
      const shouldShow = window.gContextMenu.onSaveableLink || window.gContextMenu.onPlainTextLink;
      document.getElementById('context-sep-open').hidden = !shouldShow;
      menuItem.hidden = !shouldShow;

      // Handle clicking on it and open link in default browser
      window.gContextMenu.openLinkInDefaultBrowser = function () {
        MailIntegration._launchExternalUrl(makeURI(this.linkURL));
      };
    });
  }

  createOpenDefaultBrowserShortcut () {
    // Create a shortcut (Ctrl+Shift+N) to open a default browser
    document.addEventListener('keydown', (event) => {
      if (event.key === 'N' && event.ctrlKey && event.shiftKey) {
        MailIntegration._launchExternalUrl(makeURI('about:newtab'));
        event.preventDefault();
      }
    });

    // Create a menu item for this shortcut
    let menuItemAdded = false;
    document.getElementById('PanelUI-menu-button').addEventListener('click', () => {
      if (menuItemAdded) return;
      menuItemAdded = true;

      document.getElementById('appMenu-new-private-window-button2').after(this.createElement(document, 'toolbarbutton', {
        class: 'subviewbutton',
        shortcut: 'Ctrl+Shift+N',
        label: 'New default browser',
        onclick: 'MailIntegration._launchExternalUrl(makeURI("about:newtab"))'
      }));
    });
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

    // Switch popup sides for multiview panels if needed and handle panels shown from overflow menu
    PanelMultiView._openPopup = PanelMultiView.openPopup;
    PanelMultiView.openPopup = async (...args) => {
      if (typeof args[2] === 'string') args[2] = { position: args[2] };

      if (args[2].position === 'bottomcenter topleft' && args[0].clientWidth + 50 < args[1].getBoundingClientRect().left) args[2].position = 'bottomcenter topright';
      else if (args[2].position === 'bottomcenter topright' && args[0].clientWidth + 50 > args[1].getBoundingClientRect().left) args[2].position = 'bottomcenter topleft';

      // If tracking protection panel is opened when widget is in menu, reassign anchor element
      if (args[1].id === 'tracking-protection-button' && args[1].trackingProtectionAreaType !== CustomizableUI.TYPE_TOOLBAR) {
        args[1] = document.getElementById('nav-bar-overflow-button');
      }

      // If identity panel is opened when widget is in menu, reassign anchor element
      if (args[1].id === 'identity-button' && args[1].identityAreaType !== CustomizableUI.TYPE_TOOLBAR) {
        args[1] = document.getElementById('nav-bar-overflow-button');
      }

      // If permissions panel is opened when widget is in menu, reassign anchor element
      if (args[0].id === 'permission-popup' && args[1].parentElement.permissionsAreaType !== CustomizableUI.TYPE_TOOLBAR) {
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

  handleRegisteringProtocols () {
    // Overwrites original Firefox functions with our custom installation process
    // Some checks here are directly based on the Firefox code, licensed under MPL 2.0
    // Original source: https://github.com/mozilla/gecko-dev/blob/a62618baa72cd0ba6c0a5f5fc0b1d63f2866b7c6/browser/components/protocolhandler/WebProtocolHandlerRegistrar.jsm

    const { WebProtocolHandlerRegistrar } = Cu.import('resource:///modules/WebProtocolHandlerRegistrar.jsm');

    WebProtocolHandlerRegistrar.prototype.registerProtocolHandler = function (protocol, url, title, documentURI, browserOrWindow) {
      protocol = (protocol || '').toLowerCase();
      if (!url || !documentURI) return;

      // Some special handling for e10s and non-e10s
      let browser = browserOrWindow;
      if (browserOrWindow instanceof Ci.nsIDOMWindow) {
        let rootDocShell = browserOrWindow.docShell.sameTypeRootTreeItem;
        browser = rootDocShell.QueryInterface(Ci.nsIDocShell).chromeEventHandler;
      }

      // Check if protocol handler is allowed
      try { browser.ownerGlobal.navigator.checkProtocolHandlerAllowed(protocol, url, documentURI) }
      catch (_) { return }

      // If the protocol handler is already registered, just return early
      // We only allow one handler (either manifest or custom) per protocol scheme
      const existingHandlers = new Set([
        ...window.gFFPWASiteConfig.config.custom_protocol_handlers,
        ...window.gFFPWASiteConfig.manifest.protocol_handlers
      ].map(handler => handler.protocol).sort());
      if (existingHandlers.has(protocol)) return;

      // Now ask the user and provide the proper callback
      const message = this._getFormattedString('addProtocolHandlerMessage', [url.host, protocol,]);

      const notificationBox = browser.getTabBrowser().getNotificationBox(browser);
      const notificationIcon = url.prePath + '/favicon.ico';
      const notificationValue = 'Protocol Registration: ' + protocol;

      const addButton = {
        label: this._getString('addProtocolHandlerAddButton'),
        accessKey: this._getString('addProtocolHandlerAddButtonAccesskey'),
        protocolInfo: { site: window.gFFPWASiteConfig.ulid, protocol: protocol, url: url.spec },

        async callback (notification, buttonInfo) {
          // Send a request to the native program to register the handler
          const response = await sendNativeMessage({
            cmd: 'RegisterProtocolHandler',
            params: {
              site: buttonInfo.protocolInfo.site,
              protocol: buttonInfo.protocolInfo.protocol,
              url: buttonInfo.protocolInfo.url,
            }
          })
          if (response.type === 'Error') throw new Error(response.data)
          if (response.type !== 'ProtocolHandlerRegistered') throw new Error(`Received invalid response type: ${response.type}`)

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
    }

    WebProtocolHandlerRegistrar.prototype.removeProtocolHandler = function (protocol, url) {
      (async () => {
        // Send a request to the native program to unregister the handler
        const response = await sendNativeMessage({
          cmd: 'UnregisterProtocolHandler',
          params: {
            site: window.gFFPWASiteConfig.ulid,
            protocol,
            url,
          }
        })
        if (response.type === 'Error') throw new Error(response.data)
        if (response.type !== 'ProtocolHandlerUnregistered') throw new Error(`Received invalid response type: ${response.type}`)

        // Reset the handlerInfo to ask before the next use
        const eps = Cc['@mozilla.org/uriloader/external-protocol-service;1'].getService(Ci.nsIExternalProtocolService);
        const handlerInfo = eps.getProtocolHandlerInfo(protocol);
        handlerInfo.alwaysAskBeforeHandling = true;
      })()
    }
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
        if (!xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE)) window.close();
        else window.gBrowser.removeTab(window.gBrowser.selectedTab);
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

  handleHiddenTitlebar () {
    // This can be unstable feature and is only meant for tiling window manager users
    // So it is disabled by default and can be enabled using about:config preference
    if (!xPref.get(ChromeLoader.PREF_ENABLE_HIDING_ICON_BAR)) return;

    // Setting the toolbar name will automatically add it to toolbars menu in customize page
    const titleBar = document.getElementById('titlebar');
    const iconBar = document.getElementById('TabsToolbar');
    iconBar.setAttribute('toolbarname', 'Icon Bar');

    // Hide tabs/icon bar on launch if it should be hidden by default
    // Also prevent un-collapsing of tabs/icon bar by some Firefox function
    let shownByDefault = Services.xulStore.getValue(window.document.documentURI, iconBar.id, 'collapsed') !== 'true';
    if (!shownByDefault) {
      window.TabBarVisibility.update = function () {}
      titleBar.setAttribute('autohide', 'true');
      iconBar.setAttribute('collapsed', 'true');
    }

    // Handle hiding and showing tabs/icon bar using shortcuts
    // Only Ctrl and Alt keys have to be pressed for the bar to toggle
    // Pressing other keys cancels the shortcut to prevent interfering with other shortcuts
    const pressedKeysAll = new Map();
    const pressedKeysNow = new Map();

    document.addEventListener('keydown', event => {
      if (shownByDefault) return;

      const pressedCode = event.code.replace('Right', 'Left')
      pressedKeysAll.set(pressedCode, true);
      pressedKeysNow.set(pressedCode, true);
    })

    document.addEventListener('keyup', event => {
      if (shownByDefault) return;

      const pressedCode = event.code.replace('Right', 'Left')
      pressedKeysNow.delete(pressedCode);

      // Both Ctrl and Alt have to be pressed
      // No other keys have been pressed in this combination
      // All keys have been released (this is the last keyup)
      // We add additional check to prevent triggering on AltGraph
      if (
        pressedKeysAll.get('ControlLeft') &&
        pressedKeysAll.get('AltLeft') &&
        pressedKeysAll.size === 2 &&
        pressedKeysNow.size === 0 &&
        (event.key !== 'AltGraph')
      ) {
        if (iconBar.hasAttribute('collapsed')) {
          titleBar.removeAttribute('autohide');
          iconBar.removeAttribute('collapsed');
        } else {
          titleBar.setAttribute('autohide', 'true');
          iconBar.setAttribute('collapsed', 'true');
        }
      }

      if (pressedKeysNow.size === 0) {
        pressedKeysAll.clear();
        pressedKeysNow.clear();
      }
    });

    // Prevent hiding tabs/icon bar when it is shown by default
    hookFunction(window, 'setToolbarVisibility', (toolbar, visible, persist) => {
      if (toolbar === iconBar && persist) {
        if (!visible) {
          titleBar.setAttribute('autohide', 'true');
          window.TabBarVisibility.update = function () {};
        } else  {
          titleBar.removeAttribute('autohide');
        }

        shownByDefault = visible;
      }
    })

    // Show/hide main titlebar when menu bar is active/inactive
    document.addEventListener('DOMMenuBarActive', () => {
      titleBar.removeAttribute('autohide');
    });

    document.addEventListener('DOMMenuBarInactive', () => {
      titleBar.setAttribute('autohide', 'true');
    });
  }

  handleTabsMode () {
    // Enable tabs mode if needed
    const tabsModeEnabled = xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE);
    document.documentElement.toggleAttribute('tabsmode', tabsModeEnabled);

    // Set the new tab URL to a site start URL
    Object.defineProperty(window.AboutNewTab, '_newTabURL', {
      get () {
        const win = Services.wm.getMostRecentWindow('navigator:browser');
        const userStartUrl = win.gFFPWASiteConfig.config.start_url;
        const manifestStartUrl = win.gFFPWASiteConfig.manifest.start_url;
        return userStartUrl ? userStartUrl : manifestStartUrl;
      }
    });

    // Make sure Firefox knows the new tab URL has been overridden
    window.AboutNewTab._newTabURLOverridden = true;

    // Do not treat the new tab URL as an initial and a blank page
    // This is needed to prevent breaking start URL identity widget and URL display
    window.isInitialPage = function (url) {
      if (!(url instanceof Ci.nsIURI)) {
        try { url = Services.io.newURI(url) }
        catch (_) { return false }
      }

      let nonQuery = url.prePath + url.filePath;
      return gInitialPages.includes(nonQuery);
    };

    window.isBlankPageURL = function (url) {
      return url === 'about:blank' || url === 'about:home' || url === 'about:welcome';
    };
  }

  handleLinkTargets () {
    const userPreference = xPref.get(ChromeLoader.PREF_LINKS_TARGET);
    if (!userPreference) return;

    // Overwrite built-in preference based on our custom preference
    xPref.set('browser.link.open_newwindow', userPreference);

    // Opening links in new tab is a default Firefox behavior, no need to overwrite it
    if (userPreference === 3) return;

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

  handleDynamicThemeColor () {
    // Both normal theme color support and dynamic theme color need to be enabled
    if (!xPref.get(ChromeLoader.PREF_SITES_SET_THEME_COLOR) || !xPref.get(ChromeLoader.PREF_DYNAMIC_THEME_COLOR)) return;

    // Handle switching browser tabs in tabs mode
    window.gBrowser.tabbox.addEventListener('select', () => {
      if (!window.gBrowser.selectedBrowser.gFFPWACurrentColor || !this.canLoad(window.gBrowser.currentURI)) return;
      applyDynamicThemeColor(window, window.gBrowser.selectedBrowser.gFFPWACurrentColor);
    })

    // Handle theme color messages from the frame script
    // We also need to store color for each tab in case user switches it
    Services.mm.addMessageListener('firefoxpwa:theme-color', (message) => {
      if (window.gBrowser.selectedBrowser !== message.target || !this.canLoad(window.gBrowser.currentURI)) return;
      window.gBrowser.selectedBrowser.gFFPWACurrentColor = message.data.color;
      applyDynamicThemeColor(window, message.data.color);
    });

    // Inject frame script into website content
    Services.mm.loadFrameScript('data:application/javascript;charset=UTF-8,' + encodeURIComponent('(' + (function () {
      /** @typedef {Window} content */
      /* global content */
      /* global window:false, document:false, location:false */

      /**
       * @param {Element|Node} metaElement
       * @returns {boolean} If `true`, stop processing further possible elements
       */
      function handleMetaElement (metaElement) {
        if (
          metaElement.tagName.toLowerCase() === 'meta'
          && metaElement.getAttribute('name')?.toLowerCase() === 'theme-color'
          && metaElement.getAttribute('content')
          && content.matchMedia(metaElement.getAttribute('media') || '').matches
        ) {
          const colorSource = metaElement.getAttribute('content');

          // Transparent and currentColor are not supported because toolbar cannot be transparent
          // We need to return early, otherwise they would be parsed into incorrect colors
          const colorSourceLower = colorSource.trim().toLowerCase();
          if (colorSourceLower === 'transparent' || colorSourceLower === 'currentcolor') return false;

          // We use `InspectorUtils.colorToRGBA` to parse the color to RGBA, as it's also used by normal lwthemes
          // https://searchfox.org/mozilla-central/source/toolkit/modules/LightweightThemeConsumer.jsm#451-544
          const colorParsed = content.document.defaultView.InspectorUtils.colorToRGBA(colorSource);
          if (!colorParsed) return false;

          sendAsyncMessage('firefoxpwa:theme-color', { color: colorParsed });
          return true;
        }
      }

      addEventListener('DOMContentLoaded', () => {
        // Prevent loading observers and other stuff on internal pages
        if (
          content.document.location.href !== 'about:blank'
          && content.document.location.protocol !== 'http:'
          && content.document.location.protocol !== 'https:'
        ) return;

        // Obtain initial theme color
        for (const metaElement of content.document.querySelectorAll('meta[name=theme-color]')) {
          if (handleMetaElement(metaElement)) break;
        }

        // Watch for meta[name=theme-color] changes
        const observer = new content.MutationObserver(function (mutations) {
          mutations.forEach(mutation => handleMetaElement(mutation.target))
        });
        observer.observe(
          content.document.head,
          { subtree: true, childList: true, attributeFilter: ['name', 'content', 'media'] }
        );
      });
    }).toString() + ')();'), true);
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

  renameHomepageWidget () {
    hookFunction(window, 'onload', null, () => {
      try {
        this.modifyWidget('home-button', { tooltiptext: 'App Start Page' });
      } catch (_) {}
    });
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
    this.createNavigationWidgets();
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
      onCommand (event) {
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

      onCommand (event) {
        const currentUrl = gURLBar.makeURIReadable(event.target.ownerGlobal.gBrowser.selectedBrowser.currentURI).displaySpec;
        const clipboardHandler = Cc['@mozilla.org/widget/clipboardhelper;1'].getService(Ci.nsIClipboardHelper);
        clipboardHandler.copyString(currentUrl);
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

            const selectedBrowser = window.gBrowser.selectedBrowser;
            const currentUrl = gURLBar.makeURIReadable(selectedBrowser.currentURI).displaySpec;
            const currentTitle = selectedBrowser.contentTitle;

            const widgetView = document.getElementById('share-link-view');
            const widgetBody = widgetView.getElementsByClassName('panel-subview-body')[0];

            // Clear the panel view because it gets filled every time
            widgetBody.innerHTML = '';

            // Fil the view with all available services for the current URL
            const sharingService = window.gBrowser.MacSharingService;
            const services = sharingService.getSharingProviders(currentUrl);
            services.forEach(share => {
              const item = document.createXULElement('toolbarbutton');
              item.classList.add('subviewbutton');
              item.setAttribute('label', share.menuItemTitle);
              item.setAttribute('share-name', share.name);
              item.setAttribute('image', share.image);
              widgetBody.appendChild(item);
            });

            // Add share more button
            widgetBody.appendChild(document.createXULElement('toolbarseparator'));
            const moreItem = document.createXULElement('toolbarbutton');
            document.l10n.setAttributes(moreItem, 'menu-share-more');
            moreItem.classList.add('subviewbutton', 'subviewbutton-iconic', 'share-more-button');
            widgetBody.appendChild(moreItem);

            // Handle sharing using macOS services
            widgetBody.onmouseup = (event) => {
              if (event.target.classList.contains('share-more-button')) {
                gBrowser.MacSharingService.openSharingPreferences();
                return;
              }

              let shareName = event.target.getAttribute('share-name');
              if (shareName) {
                gBrowser.MacSharingService.shareUrl(shareName, currentUrl, currentTitle);
              }
            };

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

        onCommand (event) {
          const browser = event.target.ownerGlobal.gBrowser.selectedBrowser;
          const currentUrl = gURLBar.makeURIReadable(browser.currentURI).displaySpec;
          const currentTitle = browser.contentTitle;

          WindowsUIUtils.shareUrl(currentUrl, currentTitle);
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

            const widgetView = document.getElementById('send-to-device-view');
            const widgetBody = widgetView.getElementsByClassName('panel-subview-body')[0];

            // Clear the panel view because it gets filled every time
            widgetBody.innerHTML = '';

            // If user is not logged in with an account, display log in button
            if (!window.gSync.sendTabConfiguredAndLoading) {
              const accountStatus = PanelMultiView.getViewNode(document, 'appMenu-fxa-status2').cloneNode(true);
              widgetBody.appendChild(accountStatus);
              return true;
            }

            // Populate the panel view with the device list
            window.gSync.populateSendTabToDevicesView(widgetView);
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

      onCommand (event) {
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

        // Create autohide panel with checkbox and handle changing the preference
        setTimeout(() => {
          const muteAutohidePanel = window.gFFPWABrowser.createElement(document, 'panel', {
            id: 'mute-button-autohide-panel',
            role: 'group',
            type: 'arrow'
          });

          const muteAutohideCheckbox = window.gFFPWABrowser.createElement(document, 'checkbox', {
            id: 'mute-button-autohide-checkbox',
            label: 'Hide button when not playing',
            checked: true,
          });

          muteAutohideCheckbox.onclick = function () {
            xPref.set(ChromeLoader.PREF_AUTOHIDE_MUTE_BUTTON, this.checked);
          };

          muteAutohidePanel.appendChild(muteAutohideCheckbox);
          window.document.getElementById('downloads-button-autohide-panel').after(muteAutohidePanel);
        });

        // Force show widget on customize mode page and reset its state
        // Also handle showing autohide panel and the checkbox
        hookFunction(window.gCustomizeMode, 'enter', null, () => {
          node.setAttribute('playing', 'true');
          node.removeAttribute('muted');
          node.hidden = false;

          document.getElementById('wrapper-mute-button').onclick = () => {
            document.getElementById('mute-button-autohide-checkbox').checked = xPref.get(ChromeLoader.PREF_AUTOHIDE_MUTE_BUTTON);
            document.getElementById('mute-button-autohide-panel').openPopup(node, 'rightcenter topleft', -8, 0);
          }
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
              const autoHideEnabled = xPref.get(ChromeLoader.PREF_AUTOHIDE_MUTE_BUTTON);
              if (!browser.audioMuted) node.hidden = autoHideEnabled;
            }
          }

          if (browser.audioMuted) {
            node.setAttribute('muted', 'true');
            node.hidden = false;
          } else {
            node.removeAttribute('muted');
            const autoHideEnabled = xPref.get(ChromeLoader.PREF_AUTOHIDE_MUTE_BUTTON);
            if (!node.hasAttribute('playing')) node.hidden = autoHideEnabled;
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
                const autoHideEnabled = xPref.get(ChromeLoader.PREF_AUTOHIDE_MUTE_BUTTON);
                if (!browser.audioMuted) node.hidden = autoHideEnabled;
              }
            }, 1000);
          });

          hookFunction(tab, 'toggleMuteAudio', null, () => {
            if (browser.audioMuted) {
              node.setAttribute('muted', 'true');
              node.hidden = false;
            } else {
              node.removeAttribute('muted');
              const autoHideEnabled = xPref.get(ChromeLoader.PREF_AUTOHIDE_MUTE_BUTTON);
              if (!node.hasAttribute('playing')) node.hidden = autoHideEnabled;
            }
          });
        }

        hookPlaybackStatus();
        hookFunction(window.gBrowser, 'updateCurrentBrowser', null, hookPlaybackStatus);

        // Hide it by default when in toolbar, otherwise always show playing icon
        if (muteWidgetAreaType === CustomizableUI.TYPE_TOOLBAR) {
          node.hidden = xPref.get(ChromeLoader.PREF_AUTOHIDE_MUTE_BUTTON);
        } else {
          node.setAttribute('playing', 'true');
          node.hidden = false;
        }
      },
      onCommand (event) {
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
      onCommand (event) {
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

      onCreated (node) {
        const document = node.ownerDocument;
        const window = document.defaultView;

        // Do not override identity widget box if inside a popup window
        if (!window.toolbar.visible) return;

        Object.defineProperty(window.gIdentityHandler, '_identityIconBox', { get: () => node });
        let defaultTooltip = node.getAttribute('tooltiptext');

        // Store and update current widget area
        node.identityAreaType = CustomizableUI.getAreaType(this.currentArea);

        let listener = {
          onWidgetAdded: (widget, area) => {
            if (widget !== this.id) return;
            node.identityAreaType = CustomizableUI.getAreaType(area);
          },
          onWidgetMoved: (widget, area) => {
            if (widget !== this.id) return;
            node.identityAreaType = CustomizableUI.getAreaType(area);
          },
          onWidgetRemoved: (widget) => {
            if (widget !== this.id) return;
            node.identityAreaType = undefined;
          },
          onWidgetInstanceRemoved: (widget, doc) => {
            if (widget !== this.id || doc !== document) return;

            CustomizableUI.removeListener(listener);
            node.identityAreaType = undefined;
          },
        };
        CustomizableUI.addListener(listener);

        // Sync attributes from old icon to the new one and update tooltip
        hookFunction(document.getElementById('identity-icon'), 'setAttribute', null, (_, [ name, value ]) => {
          if (name === 'tooltiptext') {
            if (value) node.setAttribute(name, value);
            else node.setAttribute(name, defaultTooltip);
          }

          const identityIcon = node.getElementsByClassName('toolbarbutton-icon')[0];
          if (identityIcon) identityIcon.className = 'toolbarbutton-icon ' + document.getElementById('identity-box').className;
        });

        hookFunction(document.getElementById('identity-box'), 'setAttribute', null, () => {
          const identityIcon = node.getElementsByClassName('toolbarbutton-icon')[0];
          if (identityIcon) identityIcon.setAttribute('pageproxystate', document.getElementById('identity-box').getAttribute('pageproxystate'));
        });
      },
      onCommand (event) {
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

      onCreated: (node) => {
        const document = node.ownerDocument;
        const window = document.defaultView;

        const permissionBox = document.getElementById('identity-permission-box');
        permissionBox.classList.add('toolbarbutton-icon');

        // Store and update current widget area
        node.permissionsAreaType = CustomizableUI.getWidget(node.id).areaType;

        if (node.permissionsAreaType !== CustomizableUI.TYPE_TOOLBAR) node.setAttribute('in-menu', 'true');
        else node.removeAttribute('in-menu');

        let listener = {
          onWidgetAdded: (widget, area) => {
            if (widget !== node.id) return;
            node.permissionsAreaType = CustomizableUI.getAreaType(area);

            if (node.permissionsAreaType !== CustomizableUI.TYPE_TOOLBAR) node.setAttribute('in-menu', 'true');
            else node.removeAttribute('in-menu');
          },
          onWidgetMoved: (widget, area) => {
            if (widget !== node.id) return;
            node.permissionsAreaType = CustomizableUI.getAreaType(area);

            if (node.permissionsAreaType !== CustomizableUI.TYPE_TOOLBAR) node.setAttribute('in-menu', 'true');
            else node.removeAttribute('in-menu');
          },
          onWidgetRemoved: (widget) => {
            if (widget !== node.id) return;
            node.permissionsAreaType = undefined;
          },
          onWidgetInstanceRemoved: (widget, doc) => {
            if (widget !== node.id || doc !== document) return;

            CustomizableUI.removeListener(listener);
            node.permissionsAreaType = undefined;
          },
        };
        CustomizableUI.addListener(listener);

        // Replace generic widget icon with permission box
        // Reverse permissions icons inside the permission box
        const observer = new MutationObserver(mutations => {
          for (const mutation of mutations) {
            for (const addedNode of mutation.addedNodes) {
              if (addedNode.tagName === 'image' && addedNode.className === 'toolbarbutton-icon') {
                addedNode.replaceWith(permissionBox);
                this.reverseChildren(permissionBox);
                observer.disconnect();
              }
            }
          }
        });
        observer.observe(node, { childList: true });

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
      onCommand (event) {
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

        // Replace generic widget icon with notifications box
        // Reverse permissions icons inside the notifications box
        const observer = new MutationObserver(mutations => {
          for (const mutation of mutations) {
            for (const addedNode of mutation.addedNodes) {
              if (addedNode.tagName === 'image' && addedNode.className === 'toolbarbutton-icon') {
                addedNode.replaceWith(notificationsBox);
                this.reverseChildren(notificationsBox);
                observer.disconnect();
              }
            }
          }
        });
        observer.observe(node, { childList: true });

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

            if (!args[0]) {
              args[0] = document.getElementById('PanelUI-menu-button');
            }

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

      onCommand (event) {
        const window = event.target.ownerGlobal;

        if (window.gFFPWALastScopeUri) {
          let lastScopeTab = window.gBrowser.tabs.find((tab, index) => window.gBrowser.getBrowserAtIndex(index).currentURI === window.gFFPWALastScopeUri);

          if (lastScopeTab) {
            // Switch to the last tab with scope URI if it exists
            let currentTab = window.gBrowser.selectedTab;
            window.gBrowser.tabContainer._selectNewTab(lastScopeTab);
            window.gBrowser.removeTab(currentTab);
          } else {
            // Otherwise, open the last scope URI in the current tab
            window.openWebLinkIn(window.gFFPWALastScopeUri.spec, 'current');
          }
        } else {
          window.close();
        }
      }
    });
  }

  createNavigationWidgets () {
    // Create simple movable back and forward navigation widgets
    // They do not support history list dropdown, but this is not very important
    // Needed because vanilla navigation widgets cannot be moved because removing them causes crash

    CustomizableUI.createWidget({
      id: 'back-button-ffpwa',
      type: 'button',

      label: 'Back',
      tooltiptext: 'Go back one page',

      onCommand (event) {
        const window = event.target.ownerGlobal;
        window.BrowserBack(event);
      }
    });

    CustomizableUI.createWidget({
      id: 'forward-button-ffpwa',
      type: 'button',

      label: 'Forward',
      tooltiptext: 'Go back one page',

      onCommand (event) {
        const window = event.target.ownerGlobal;
        window.BrowserForward(event);
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
  }

  //////////////////////////////
  // Configuration
  //////////////////////////////

  configureAll () {
    this.configureLayout();
    this.configureWidgets();
    this.configureSettings();
    this.disableOnboarding();
  }

  configureLayout () {
    // Configure default layout
    let { gAreas } = Cu.import('resource:///modules/CustomizableUI.jsm');
    gAreas.get(CustomizableUI.AREA_NAVBAR).set('defaultPlacements', ['close-page-button', 'back-button', 'forward-button', 'urlbar-container']);
    gAreas.get(CustomizableUI.AREA_TABSTRIP).set('defaultPlacements', ['site-info', 'tabbrowser-tabs', 'new-tab-button', 'alltabs-button', 'mute-button', 'notifications-button', 'permissions-button', 'downloads-button', 'tracking-protection-button', 'identity-button']);
    gAreas.get(CustomizableUI.AREA_BOOKMARKS).set('defaultCollapsed', 'never');

    // Reset layout to default on the first run, otherwise widgets are misplaced
    // We can check for the first run using telemetry reporting policy preference
    // Although this relies on the telemetry module, it still works on LibreWolf where telemetry is disabled
    setTimeout(() => {
      if (xPref.get('toolkit.telemetry.reportingpolicy.firstRun', false, true)) {
        CustomizableUI.reset();
      }
    });
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

    // Make Firefox Profiler button go to the tab strip area by default
    const { ProfilerMenuButton } = ChromeUtils.import('resource://devtools/client/performance-new/popup/menu-button.jsm.js');
    ProfilerMenuButton.addToNavbar = function (document) {
      CustomizableUI.addWidgetToArea('profiler-button', CustomizableUI.AREA_TABSTRIP);
    }
  }

  configureSettings () {
    // Configure default built-in preferences
    xPref.set('browser.toolbars.bookmarks.visibility', 'never', true);
    xPref.set('browser.taskbar.lists.enabled', false, true);
    xPref.set('browser.tabs.drawInTitlebar', true, true);
    xPref.set('browser.tabs.inTitlebar', 1, true);
    xPref.set('browser.tabs.extraDragSpace', false, true);
    xPref.set('browser.tabs.warnOnClose', false, true);
    xPref.set('browser.sessionstore.resume_from_crash', false, true);
    xPref.set('browser.shell.checkDefaultBrowser', false, true);
    xPref.set('browser.startup.upgradeDialog.enabled', false, true);
    xPref.set('browser.aboutwelcome.enabled', false, true);
    xPref.set('browser.messaging-system.whatsNewPanel.enabled', false, true);
    xPref.set('browser.privateWindowSeparation.enabled', false, true);
    xPref.set('browser.privacySegmentation.createdShortcut', true, true);
    xPref.set('browser.uidensity', 1, true);
    xPref.set('browser.link.open_newwindow', 1, true);
    xPref.set('datareporting.policy.firstRunURL', '', true);

    // Set distribution details
    xPref.set('distribution.id', ChromeLoader.DISTRIBUTION_ID, true);
    xPref.set('distribution.version', ChromeLoader.DISTRIBUTION_VERSION, true);
    xPref.set('distribution.about', ChromeLoader.DISTRIBUTION_ABOUT, true);

    // Determines whether `_blank` links target is forced into the current tab or a new window
    // 0 - Do not change link behaviour (strongly not recommended)
    // 1 - Force links into the current tab (default)
    // 2 - Force links into a new window
    // 3 - Force links into a new tab
    xPref.set(ChromeLoader.PREF_LINKS_TARGET, 1, true);

    // Determines whether URL bar is displayed always, when out of scope or never
    // 0 - Display URL bar when out of scope (default)
    // 1 - Never display URL bar (strongly not recommended)
    // 2 - Always display URL bar
    xPref.set(ChromeLoader.PREF_DISPLAY_URL_BAR, 0, true);

    // Determines whether the mute (toggle sound) button should automatically hide when nothing is playing
    xPref.set(ChromeLoader.PREF_AUTOHIDE_MUTE_BUTTON, true, true);

    // Determines whether the sites can override theme (titlebar) color
    xPref.set(ChromeLoader.PREF_SITES_SET_THEME_COLOR, true, true);

    // Determines whether the sites can override background color
    xPref.set(ChromeLoader.PREF_SITES_SET_BACKGROUND_COLOR, true, true);

    // Determines whether sites can dynamically change theme color using meta element
    xPref.set(ChromeLoader.PREF_DYNAMIC_THEME_COLOR, true, true);

    // Determines whether the window title is dynamically changed to the site title
    xPref.set(ChromeLoader.PREF_DYNAMIC_WINDOW_TITLE, true, true);

    // Determines whether the window icon is dynamically changed to the site icon
    xPref.set(ChromeLoader.PREF_DYNAMIC_WINDOW_ICON, true, true);

    // Determines whether out of scope URLs should be opened in a default browser
    xPref.set(ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER, false, true);

    // Determines whether to open a web app in an existing window of that web app
    // Should only be used when the tabs mode is enabled
    xPref.set(ChromeLoader.PREF_OPEN_IN_EXISTING_WINDOW, false, true);

    // Determines whether the tabs mode is enabled
    xPref.set(ChromeLoader.PREF_ENABLE_TABS_MODE, false, true);

    // Determines whether hiding icon bar is allowed and option is displayed in the customize page
    xPref.set(ChromeLoader.PREF_ENABLE_HIDING_ICON_BAR, false, true);

    // Determines whether native window controls should be displayed even when using lwtheme
    // Only has effect on Linux with CSD enabled
    xPref.set(ChromeLoader.PREF_ALWAYS_USE_NATIVE_WINDOW_CONTROLS, false, true);

    // Determines which domains should always be allowed to open in the PWA browser
    // This is a comma-separated list of domains
    xPref.set(ChromeLoader.PREF_ALLOWED_DOMAINS, '', true);
  }

  disableOnboarding () {
    const { OnboardingMessageProvider } = ChromeUtils.import('resource://activity-stream/lib/OnboardingMessageProvider.jsm');
    OnboardingMessageProvider.getMessages = async () => [];
    OnboardingMessageProvider.getUntranslatedMessages = async () => [];
    OnboardingMessageProvider.getUntranslatedMessages = async () => null;

    const { BrowserGlue } = ChromeUtils.import('resource:///modules/BrowserGlue.jsm');
    BrowserGlue.prototype._maybeShowDefaultBrowserPrompt = async () => null;
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

window.gFFPWABrowser = new PwaBrowser();
