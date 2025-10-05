import { WebNavigationManager } from 'resource://gre/modules/WebNavigation.sys.mjs';
import { XPCOMUtils } from 'resource://gre/modules/XPCOMUtils.sys.mjs';

import { sanitizeString } from 'resource://pwa/utils/common.sys.mjs';
import { hookFunction } from 'resource://pwa/utils/hookFunction.sys.mjs';
import { xPref } from 'resource://pwa/utils/xPref.sys.mjs';

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  applyDynamicThemeColor: 'resource://pwa/utils/systemIntegration.sys.mjs',
  applySystemIntegration: 'resource://pwa/utils/systemIntegration.sys.mjs',
  buildIconList: 'resource://pwa/utils/systemIntegration.sys.mjs',
});

XPCOMUtils.defineLazyServiceGetter(lazy, 'ioService', '@mozilla.org/network/io-service;1', Ci.nsIIOService);
XPCOMUtils.defineLazyServiceGetter(lazy, 'WindowsUIUtils', '@mozilla.org/windows-ui-utils;1', Ci.nsIWindowsUIUtils);

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
    this.loadLocalizationSources();
    this.supportSmallWindowSizes();
    this.createInfoElements();
    this.createAddressInput();
    this.createNotificationAnchor();
    this.createOpenInBrowserMenuItem();
    this.createOpenDefaultBrowserShortcut();
    this.moveMenuButtons();
    this.switchPopupSides();
    this.makeUrlBarReadOnly();
    setTimeout(() => { this.setDisplayModeStandalone() });
    this.handleOutOfScopeNavigation();
    this.handleOpeningNewWindow();
    this.handleDisablingShortcuts();
    this.handleHiddenExtensionsButton();
    setTimeout(() => { this.handleHiddenExtensionsButton() });
    setTimeout(() => { this.handleHiddenTitlebar() });
    setTimeout(() => { this.handleTabsMode() });
    setTimeout(() => { this.handleLinkTargets() });
    setTimeout(() => { this.handleDynamicThemeColor() });
    setTimeout(() => { this.renameOpenImageAction() });
    setTimeout(() => { this.disableNewTabShortcuts() });
    this.renameHomepageWidget();
    this.handleKioskMode();
  }

  loadLocalizationSources () {
    const resourceIds = ['pwa/appmenu.ftl', 'pwa/contextmenu.ftl', 'pwa/browser.ftl', 'pwa/widgets.ftl', 'pwa/customizemode.ftl'];
    document.l10n.addResourceIds(resourceIds.map(resource => ({ path: resource, optional: true })));
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

    const tabLabelContainer = this.createElement(document, 'hbox', { class: 'tab-label-container' });
    tabLabelContainer.addEventListener('overflow', () => tabLabelContainer.setAttribute('textoverflow', 'true'));
    tabLabelContainer.addEventListener('underflow', () => tabLabelContainer.removeAttribute('textoverflow'));
    const tabLabel = this.createElement(document, 'label', { class: 'tab-text tab-label', role: 'presentation', fadein: 'true' });
    tabLabelContainer.append(tabLabel);
    siteInfo.append(tabLabelContainer);

    document.getElementById('TabsToolbar-customization-target').append(siteInfo);

    // Set initial favicon and title to the site's static info
    const siteIcons = lazy.buildIconList(window.gFFPWASiteConfig?.manifest.icons || []);
    const siteIcon = siteIcons.find(icon => icon.size >= 32) || siteIcons[siteIcons.length - 1];
    if (siteIcon) tabIconImage.setAttribute('src', siteIcon.icon.src);

    const siteScope = window.gFFPWASiteConfig?.manifest.scope ? new URL(window.gFFPWASiteConfig.manifest.scope).host : null;
    const siteName = sanitizeString(window.gFFPWASiteConfig?.config.name || window.gFFPWASiteConfig?.manifest.name || window.gFFPWASiteConfig?.manifest.short_name) || siteScope;
    tabLabel.replaceChildren(siteName);
    document.title = siteName;

    // Sync current tab favicon and title with custom info elements
    // This can be disabled by user using our preferences
    const docDS = document.documentElement.dataset;
    docDS['contentTitleDefault'] = docDS['contentTitlePrivate'] = 'CONTENTTITLE';
    docDS['titleDefault'] = docDS['titlePrivate'] = siteName;
    setTimeout(() => {
      window.gBrowser.updateTitlebar = function () {
        const dynamicTitle = xPref.get(ChromeLoader.PREF_DYNAMIC_WINDOW_TITLE);
        if (dynamicTitle) document.title = this.getWindowTitleForBrowser(this.selectedBrowser);
      };
    });

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
    async function addressInputHandle () {
      const url = prompt(await document.l10n.formatValue('popup-address-input'));
      if (url) window.openTrustedLinkIn(url, 'current');
    }

    // Handle opening with F6
    document.addEventListener('keydown', (event) => {
      if (event.key === 'F6') {
        event.preventDefault();
        addressInputHandle();
      }
    }, true);

    // Handle opening with Ctrl+L and Alt+D (Browser:OpenLocation)
    window.openLocation = _ => {
      addressInputHandle();
    };

    // Handle opening with Ctrl+K and Ctrl+J/Ctrl+E/Cmd+Opt+F (Tools:Search)
    SearchUIUtils.webSearch = _ => {
      addressInputHandle();
    };
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

    // Quick fix to prevent error on Firefox ESR 128
    // We can remove it when ESR 128 is no longer supported
    try { let _ = nsContextMenu }
    catch (error) { return }

    // Create context menu item that opens link in a default browser
    const menuItem = this.createElement(document, 'menuitem', { id: 'contextmenu-openlinkdefault', 'data-l10n-id': 'context-menu-open-link-default-browser' });
    menuItem.addEventListener('command', () => gContextMenu.openLinkInDefaultBrowser());
    document.getElementById('context-sep-open').before(menuItem)

    // Handle clicking on it and open link in default browser
    nsContextMenu.prototype.openLinkInDefaultBrowser = function () {
      MailIntegration._launchExternalUrl(makeURI(this.linkURL));
    };

    hookFunction(nsContextMenu.prototype, 'initOpenItems', null, function () {
      // Display it only when clicked on links
      const shouldShow = this.onSaveableLink || this.onPlainTextLink;
      document.getElementById('context-sep-open').hidden = !shouldShow;
      menuItem.hidden = !shouldShow;
    });
  }

  createOpenDefaultBrowserShortcut () {
    const startURL = window.HomePage.get(window);

    // Create a shortcut (Ctrl+Shift+N) to open a default browser
    document.addEventListener('keydown', (event) => {
      if (event.key === 'N' && event.ctrlKey && event.shiftKey) {
        MailIntegration._launchExternalUrl(makeURI(startURL));
        event.preventDefault();
      }
    });

    // Create a menu item for this shortcut
    let menuItemAdded = false;
    document.getElementById('PanelUI-menu-button').addEventListener('click', () => {
      if (menuItemAdded) return;
      menuItemAdded = true;

      const menuItem = this.createElement(document, 'toolbarbutton', {
        class: 'subviewbutton',
        shortcut: 'Ctrl+Shift+N',
        'data-l10n-id': 'app-menu-new-default-browser'
      });

      menuItem.onclick = () => MailIntegration._launchExternalUrl(makeURI(startURL));
      document.getElementById('appMenu-new-private-window-button2').after(menuItem);
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

    // Remove duplicate unified extensions button
    document.querySelector('#nav-bar > #unified-extensions-button')?.remove();

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

      // If unified extensions panel is opened when widget is in menu, reassign anchor element
      if (
        args[1].id === 'unified-extensions-button'
        && args[1].unifiedExtensionsAreaType !== CustomizableUI.TYPE_TOOLBAR
      ) {
        args[1] = document.getElementById('nav-bar-overflow-button');
      }

      // If specific extension panel is opened when widget is in menu, reassign anchor element
      if (
        args[1].getAttribute('consumeanchor') === 'unified-extensions-button'
        && document.getElementById('unified-extensions-button').unifiedExtensionsAreaType !== CustomizableUI.TYPE_TOOLBAR
      ) {
        args[1] = document.getElementById('nav-bar-overflow-button');
      }

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

    // Restore the original toolbar visibility
    window.toolbar.visible = originalToolbarVisibility;

    // Prevent error when changing search mode when `searchModeSwitcher` is undefined
    Object.defineProperty(window.gURLBar, 'searchMode', {
      set: function (searchMode) {
        this.setSearchMode(searchMode, this.window.gBrowser.selectedBrowser);
        this.searchModeSwitcher?.onSearchModeChanged();
      },
    });
  }

  setDisplayModeStandalone () {
    function hookCurrentBrowser () {
      // Set the display mode on the main browser window
      if (location.href === AppConstants.BROWSER_CHROME_URL && window.gBrowser?.selectedBrowser?.browsingContext) {
        window.gBrowser.selectedBrowser.browsingContext.displayMode = 'standalone';
      }
    }

    hookFunction(window.gBrowser, 'init', null, hookCurrentBrowser);
    hookFunction(window.gBrowser, 'updateCurrentBrowser', null, hookCurrentBrowser);
    hookCurrentBrowser();
  }

  handleOutOfScopeNavigation () {
    function matchWildcard(wildcard, string) {
      const pattern = wildcard
        .replaceAll(/[.+?^=!:${}()|\[\]\/\\]/g, '\\$&')
        .replaceAll('\\\\*', '\\*')
        .replaceAll(/(?<!\\)\*/g, '.*');

      const regex = new RegExp(`^${pattern}$`);
      return regex.test(string);
    }

    // For this check to pass, opening out-of-scope URLs in default browser must be enabled
    // Additionally, the URL must not be one of allow-listed or restricted domains
    // Otherwise, it is impossible to access certain parts of Firefox
    const checkOutOfScope = (uri, target = null) => !this.canLoad(uri, target) &&
      uri.scheme.startsWith('http') &&
      xPref.get(ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER) &&
      !xPref.get(ChromeLoader.PREF_ALLOWED_DOMAINS).split(',').some(pattern => matchWildcard(pattern, uri.host)) &&
      !xPref.get('extensions.webextensions.restrictedDomains').split(',').includes(uri.host);

    // Handle hiding/showing URL bar when the URL is out-of-scope
    hookFunction(window.gURLBar, 'setURI', null, (_, [uri]) => {
      // Check whether the URL is in scope
      const canLoad = this.canLoad(uri);
      let displayBar = !canLoad && !uri.spec.startsWith('about:firefoxview');

      // Change URL bar behavior based on our custom preference
      const userPreference = xPref.get(ChromeLoader.PREF_DISPLAY_URL_BAR);
      if (userPreference === 1) displayBar = false;
      else if (userPreference === 2) displayBar = true;

      // Display URL bar when the website it out-of-scope
      document.getElementById('nav-bar').classList.toggle('shown', displayBar);
      window.gURLBar.updateLayoutBreakout?.();

      // Store the last in-scope URL so the close widget can return to it
      if (canLoad && uri && uri.spec !== 'about:blank') {
        window.gFFPWALastScopeUri = uri;
      }
    });

    if (ChromeLoader.INITIALIZED_BROWSER) return;

    // Handle blocking out-of-scope URLs and redirecting them to the main browser
    Services.obs.addObserver(subject => {
      const httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);

      // Try to obtain window from the request subject
      const chromeWindow = (() => {
        try { return subject.notificationCallbacks.getInterface(Ci.nsILoadContext).topChromeWindow }
        catch (_) { return null }
      })();

      // Skip any other checks if the request is not a top-level document request
      if (
        !httpChannel.loadInfo.isTopLevelLoad ||
        !httpChannel.isMainDocumentChannel ||
        httpChannel.requestMethod !== 'GET'
      ) {
        return;
      }

      // Open the default browser and cancel the request for out-of-scope URLs
      if (checkOutOfScope(httpChannel.URI, chromeWindow)) {
        MailIntegration._launchExternalUrl(httpChannel.URI);
        httpChannel.cancel(Cr.NS_BINDING_ABORTED);
      }
    }, 'http-on-modify-request', false);

    // Handle passing config from old to new window and closing out-of-scope windows
    // Also handles applying the system integration for "disconnected" windows
    WebNavigationManager.addListener('onCreatedNavigationTarget', details => {
      const newWindow = details.browser.ownerGlobal;
      const sourceWindow = details.sourceTabBrowser.ownerGlobal;

      // Pass config from the old window to a new one
      if (!newWindow.gFFPWASiteConfig) {
        newWindow.gFFPWASiteConfig = sourceWindow.gFFPWASiteConfig;
        lazy.applySystemIntegration(newWindow, newWindow.gFFPWASiteConfig);
      }

      // Open out-of-scope links in default browser and close the newly-opened tab
      if (checkOutOfScope(makeURI(details.url))) {
        MailIntegration._launchExternalUrl(makeURI(details.url));
        newWindow.gBrowser.removeTab(newWindow.gBrowser.tabs.find(tab => tab.linkedBrowser.currentURI.spec === 'about:blank'));
      }
    });
  }

  handleOpeningNewWindow () {
    // Handle opening new window from keyboard shortcuts
    window._openDialog = window.openDialog;
    window.openDialog = function (...args) {
      // Set the URL to the site homepage
      if (typeof args[3] === 'string' && (args[3] === 'about:home' || args[3] === 'about:blankhome' || args[3] === 'about:privatebrowsing')) {
        args[3] = window.HomePage.get(window);
      }

      // Open a new window and set a site config
      const win = window._openDialog(...args);
      win.gFFPWASiteConfig = window.gFFPWASiteConfig;

      // Return a new window
      return win;
    };
  }

  handleDisablingShortcuts () {
    const getPref = (pref) => xPref.get(pref, false, true);
    if (!getPref(ChromeLoader.PREF_SHORTCUTS_CLOSE_TAB)) document.getElementById('key_close').remove();
    if (!getPref(ChromeLoader.PREF_SHORTCUTS_CLOSE_WINDOW)) document.getElementById('key_closeWindow').remove();
    if (!getPref(ChromeLoader.PREF_SHORTCUTS_QUIT_APPLICATION)) document.getElementById('key_quitApplication').remove();
    if (!getPref(ChromeLoader.PREF_SHORTCUTS_PRIVATE_BROWSING)) document.getElementById('key_privatebrowsing').remove();
  }

  handleHiddenExtensionsButton () {
    if (!document.getElementById('unified-extensions-button')) {
      window.gUnifiedExtensions._button = document.getElementById('PanelUI-menu-button');
      window.gUnifiedExtensions._initialized = true;

      window.gUnifiedExtensions.getPopupAnchorID = function (browser, window) {
        return 'PanelUI-menu-button';
      };
    }
  }

  handleHiddenTitlebar () {
    // This can be unstable feature and is only meant for tiling window manager users
    // So it is disabled by default and can be enabled using about:config preference
    if (!xPref.get(ChromeLoader.PREF_ENABLE_HIDING_ICON_BAR)) return;

    const titleBar = document.getElementById('titlebar');
    const iconBar = document.getElementById('TabsToolbar');

    // Needed so Fluent allows translating the toolbarname attribute
    iconBar.setAttribute('data-l10n-attrs', 'toolbarname');

    // Setting the toolbar name will automatically add it to toolbars menu in customize page
    if (xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE)) document.l10n.setAttributes(iconBar, 'toolbar-tabs-ffpwa');
    else document.l10n.setAttributes(iconBar, 'toolbar-icon-ffpwa');

    // Hide tabs/icon bar on launch if it should be hidden by default
    // Also prevent un-collapsing of tabs/icon bar by some Firefox function
    const collapsedSet = Services.xulStore.hasValue(window.document.documentURI, iconBar.id, 'collapsed');
    const collapsedValue = Services.xulStore.getValue(window.document.documentURI, iconBar.id, 'collapsed');
    let shownByDefault = !collapsedSet || !(collapsedValue === 'true' || collapsedValue === '');
    if (!shownByDefault) {
      window.TabBarVisibility.update = function () {}
      titleBar?.setAttribute('autohide', 'true');
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
          titleBar?.removeAttribute('autohide');
          iconBar.removeAttribute('collapsed');
        } else {
          titleBar?.setAttribute('autohide', 'true');
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
          titleBar?.setAttribute('autohide', 'true');
          window.TabBarVisibility.update = function () {};
        } else  {
          titleBar?.removeAttribute('autohide');
        }

        shownByDefault = visible;
      }
    })

    // Show/hide main titlebar when menu bar is active/inactive
    document.addEventListener('DOMMenuBarActive', () => {
      titleBar?.removeAttribute('autohide');
    });

    document.addEventListener('DOMMenuBarInactive', () => {
      titleBar?.setAttribute('autohide', 'true');
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
        const userStartUrl = win.gFFPWASiteConfig?.config.start_url;
        const manifestStartUrl = win.gFFPWASiteConfig?.manifest.start_url;
        return userStartUrl || manifestStartUrl || 'about:blank';
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
      return url === 'about:blank' || url === 'about:home' || url === 'about:blankhome' || url === 'about:welcome';
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
    window.gBrowser._addTab = window.gBrowser.addTab
    window.gBrowser.addTab = function (url, params = {}) {
      // Allow opening new tab when entering customize mode
      if (gCustomizeMode._wantToBeInCustomizeMode || gCustomizeMode._customizing) {
        return window.gBrowser._addTab(url, params);
      }

      // Allow creating new tab when opening container confirmation page or Firefox View
      if (
        !url ||
        url.startsWith('moz-extension://d9527209-9d4d-45a7-941a-99ce3ac515b6/confirm-page.html') ||
        url.startsWith('about:firefoxview')
      ) {
        return window.gBrowser._addTab(url, params);
      }

      // Create a new tab and close the previous one when opening tabs with containers or leaving Firefox View
      if (userPreference === 1 && (
        typeof params['userContextId'] !== 'undefined' ||
        window.gBrowser.selectedTab === window.FirefoxViewHandler.tab
      )) {
        const oldTab = window.gBrowser.selectedTab;
        const newTab = window.gBrowser._addTab(url, params);
        window.gBrowser.removeTab(oldTab);
        return newTab;
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
      lazy.applyDynamicThemeColor(window, window.gBrowser.selectedBrowser.gFFPWACurrentColor);
    })

    // Handle theme color messages from the frame script
    // We also need to store color for each tab in case user switches it
    Services.mm.addMessageListener('firefoxpwa:theme-color', (message) => {
      if (window.gBrowser.selectedBrowser !== message.target || !this.canLoad(window.gBrowser.currentURI)) return;
      window.gBrowser.selectedBrowser.gFFPWACurrentColor = message.data.color;
      lazy.applyDynamicThemeColor(window, message.data.color);
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

        // Store if we found a valid meta tag
        let appliedColor = false;

        // Obtain the initial theme color
        for (const metaElement of content.document.querySelectorAll('meta[name=theme-color]')) {
          if (handleMetaElement(metaElement)) {
            appliedColor = true;
            break;
          }
        }

        // Remove the color if there is no valid tag
        if (!appliedColor) {
          sendAsyncMessage('firefoxpwa:theme-color', { color: null });
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
    // Rename open/view image/video context menu action based on links target preference
    // Links target overwrites need to be disabled when tab mode is enabled
    const userPreference = xPref.get(ChromeLoader.PREF_LINKS_TARGET);
    if (!userPreference || xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE)) return;

    const viewImage = document.getElementById('context-viewimage');
    if (userPreference === 1) document.l10n.setAttributes(viewImage, 'context-menu-image-view-current-tab');
    else if (userPreference === 3) document.l10n.setAttributes(viewImage, 'context-menu-image-view-new-tab');
    else if (userPreference === 2) document.l10n.setAttributes(viewImage, 'context-menu-image-view-new-window');

    const viewVideo = document.getElementById('context-viewvideo');
    if (userPreference === 1) document.l10n.setAttributes(viewVideo, 'context-menu-video-view-current-tab');
    else if (userPreference === 3) document.l10n.setAttributes(viewVideo, 'context-menu-video-view-new-tab');
    else if (userPreference === 2) document.l10n.setAttributes(viewVideo, 'context-menu-video-view-new-window');
  }

  disableNewTabShortcuts () {
    // New tab shortcuts are useless when the tabs mode is disabled
    if (!xPref.get(ChromeLoader.PREF_ENABLE_TABS_MODE)) {
      document.getElementById('cmd_newNavigatorTab').remove();
      document.getElementById('cmd_newNavigatorTabNoEvent').remove();
    }
  }

  renameHomepageWidget () {
    hookFunction(window, 'onload', null, () => {
      try {
        document.l10n.setAttributes(document.getElementById('home-button'), 'toolbar-button-home-ffpwa');
      } catch (_) {}
    });
  }

  handleKioskMode () {
    window.addEventListener('MozAfterPaint', () => {
      if (window.BrowserHandler.kiosk && window.toolbar.visible) {
        // Enable fullscreen when kiosk mode is enabled for non-popup windows
        window.fullScreen = true;
      }
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
    this.createUnifiedExtensionsWidget();
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
      l10nId: 'toolbar-button-reader-view',
      shortcutId: 'key_toggleReaderMode',
      type: 'button',

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
      l10nId: 'toolbar-button-copy-link',
      type: 'button',

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
        l10nId: 'toolbar-button-share-link',
        type: 'view',

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
        l10nId: 'toolbar-button-share-link',
        type: 'button',

        onCommand (event) {
          const browser = event.target.ownerGlobal.gBrowser.selectedBrowser;
          const currentUrl = gURLBar.makeURIReadable(browser.currentURI).displaySpec;
          const currentTitle = browser.contentTitle;

          lazy.WindowsUIUtils.shareUrl(currentUrl, currentTitle);
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
        l10nId: 'toolbar-button-send-to-device',
        type: 'view',

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
      l10nId: 'toolbar-button-open-in-browser',
      type: 'button',

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
      l10nId: 'toolbar-button-mute',
      shortcutId: 'key_toggleMute',
      type: 'button',

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
            'data-l10n-id': 'customize-mode-mute-button-autohide',
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

  createUnifiedExtensionsWidget () {
    // Create unified extensions widget
    CustomizableUI.createWidget({
      id: 'unified-extensions-button',
      l10nId: 'unified-extensions-button',

      onCreated (node) {
        const document = node.ownerDocument;
        const window = document.defaultView;

        // Store and update current widget area
        node.unifiedExtensionsAreaType = CustomizableUI.getAreaType(this.currentArea);

        let listener = {
          onWidgetAdded: (widget, area) => {
            if (widget !== this.id) return;
            node.unifiedExtensionsAreaType = CustomizableUI.getAreaType(area);
          },
          onWidgetMoved: (widget, area) => {
            if (widget !== this.id) return;
            node.unifiedExtensionsAreaType = CustomizableUI.getAreaType(area);
          },
          onWidgetRemoved: (widget) => {
            if (widget !== this.id) return;
            node.unifiedExtensionsAreaType = undefined;
          },
          onWidgetInstanceRemoved: (widget, doc) => {
            if (widget !== this.id || doc !== document) return;

            CustomizableUI.removeListener(listener);
            node.unifiedExtensionsAreaType = undefined;
          },
        };
        CustomizableUI.addListener(listener);
      }
    });
  }

  createTrackingProtectionWidget () {
    // Create tracking protection widget
    CustomizableUI.createWidget({
      id: 'tracking-protection-button',
      l10nId: 'toolbar-button-tracking-protection',
      type: 'button',

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
        hookFunction(window.gProtectionsHandler, 'showDisabledTooltipForTPIcon', null, async function () {
          node.setAttribute('label', (await document.l10n.formatMessages(['toolbar-button-tracking-protection']))?.[0]?.attributes?.find(attr => attr.name === 'label')?.value);
          const message = (await document.l10n.formatValue('tracking-protection-icon-disabled'))?.replace(/\.$/, '');
          node.setAttribute('aria-label', message);
          node.setAttribute('tooltiptext', message);
        });

        hookFunction(window.gProtectionsHandler, 'showActiveTooltipForTPIcon', null, async function () {
          node.setAttribute('label', (await document.l10n.formatMessages(['toolbar-button-tracking-protection']))?.[0]?.attributes?.find(attr => attr.name === 'label')?.value);
          const message = (await document.l10n.formatValue('tracking-protection-icon-active'))?.replace(/\.$/, '');
          node.setAttribute('aria-label', message);
          node.setAttribute('tooltiptext', message);
        });

        hookFunction(window.gProtectionsHandler, 'showNoTrackerTooltipForTPIcon', null, async function () {
          node.setAttribute('label', (await document.l10n.formatMessages(['toolbar-button-tracking-protection']))?.[0]?.attributes?.find(attr => attr.name === 'label')?.value);
          const message = (await document.l10n.formatValue('tracking-protection-icon-no-trackers-detected'))?.replace(/\.$/, '');
          node.setAttribute('aria-label', message);
          node.setAttribute('tooltiptext', message);
        });

        // Force show widget on customize mode page and reset its state
        hookFunction(window.gCustomizeMode, 'enter', null, () => {
          window.gProtectionsHandler._trackingProtectionIconContainer.hidden = false;
          document.l10n.setAttributes(node, 'toolbar-button-tracking-protection');
          node.getElementsByClassName('toolbarbutton-icon')[0].removeAttribute('hasException');
          node.getElementsByClassName('toolbarbutton-icon')[0].removeAttribute('active');
        });

        // Localize widget attributes when exiting customize mode
        hookFunction(window.gCustomizeMode, 'exit', null, () => {
          document.l10n.setAttributes(node, 'toolbar-button-tracking-protection');
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
      l10nId: 'toolbar-button-identity',
      type: 'button',

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
      l10nId: 'toolbar-button-permissions',
      type: 'button',

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
      l10nId: 'toolbar-button-notifications',
      type: 'button',

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
      l10nId: 'toolbar-button-close',
      type: 'button',

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
      l10nId: 'toolbar-button-back-ffpwa',
      shortcutId: 'goBackKb',
      type: 'button',

      onCommand (event) {
        const window = event.target.ownerGlobal;
        if (window.BrowserCommands) window.BrowserCommands.back(event);
        else window.BrowserBack(event);
      }
    });

    CustomizableUI.createWidget({
      id: 'forward-button-ffpwa',
      l10nId: 'toolbar-button-forward-ffpwa',
      shortcutId: 'goForwardKb',
      type: 'button',

      onCommand (event) {
        const window = event.target.ownerGlobal;
        if (window.BrowserCommands) window.BrowserCommands.forward(event);
        else window.BrowserForward(event);
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
    this.configureSettings();

    setTimeout(() => { this.configureWidgets() });
  }

  configureLayout () {
    // Configure the default placements of widgets
    const defaultPlacements = {
      [CustomizableUI.AREA_NAVBAR]: ['close-page-button', 'back-button', 'forward-button', 'urlbar-container'],
      [CustomizableUI.AREA_TABSTRIP]: ['site-info', 'tabbrowser-tabs', 'new-tab-button', 'alltabs-button', 'mute-button', 'notifications-button', 'permissions-button', 'downloads-button', 'tracking-protection-button', 'identity-button', 'unified-extensions-button']
    };

    // We cannot directly set the default placements because Firefox does not expose such a function
    // Instead, we listen for area reset events and set the default placements when the event is fired
    // In the future, we can try to implement such a function in Firefox and submit a patch

    const listener = {
      onAreaReset: (area) => {
        try {
          // Start a batch update of items
          CustomizableUI.beginBatchUpdate();

          if (defaultPlacements.hasOwnProperty(area)) {
            // Remove all existing widgets from the area
            for (const widget of CustomizableUI.getWidgetIdsInArea(area)) {
              CustomizableUI.removeWidgetFromArea(widget);
            }

            // Add default widgets to the area
            for (const [ix, widget] of defaultPlacements[area].entries()) {
              CustomizableUI.addWidgetToArea(widget, area, ix);
            }
          }
        } finally {
          // End the batch update of items
          CustomizableUI.endBatchUpdate();
        }

        // Hide bookmarks toolbar by default
        xPref.clear('browser.toolbars.bookmarks.visibility');
      },
    };
    CustomizableUI.addListener(listener);

    // Reset layout to default on the first run, otherwise widgets are misplaced
    // We can check for the first run using telemetry reporting policy preference
    // Although this relies on the telemetry module, it still works on LibreWolf where telemetry is disabled
    setTimeout(() => {
      if (xPref.get('toolkit.telemetry.reportingpolicy.firstRun', false, true)) {
        // Reset the layout to default
        CustomizableUI.reset();

        // Hide bookmarks toolbar by default
        xPref.clear('browser.toolbars.bookmarks.visibility');
      }
    });
  }

  configureWidgets () {
    // Make more widgets removable
    // Currently disabled because Firefox crashes when back and forward buttons don't exist
    // this.modifyWidget('back-button', { removable: true });
    // this.modifyWidget('forward-button', { removable: true });

    // We need to import these modules here as they are not available initially

    // Make extensions widgets go to the tab strip area by default
    const { BrowserActionBase } = ChromeUtils.importESModule('resource://gre/modules/ExtensionActions.sys.mjs');
    hookFunction(BrowserActionBase.prototype, 'getDefaultArea', null, function () {
      return this.globals.default_area === 'navbar' ? 'tabstrip' : this.globals.default_area;
    })

    // Make Firefox Profiler button go to the tab strip area by default
    const { ProfilerMenuButton } = ChromeUtils.importESModule('resource://devtools/client/performance-new/popup/menu-button.sys.mjs');
    ProfilerMenuButton.addToNavbar = function (document) {
      CustomizableUI.addWidgetToArea('profiler-button', CustomizableUI.AREA_TABSTRIP);
    }

    // Make unified extensions widgets go to the tab strip area by default
    gUnifiedExtensions.pinToToolbar = function (widgetId, shouldPinToToolbar) {
      let newArea = shouldPinToToolbar ? CustomizableUI.AREA_TABSTRIP : CustomizableUI.AREA_ADDONS;
      let newPosition = shouldPinToToolbar ? undefined : 0;

      CustomizableUI.addWidgetToArea(widgetId, newArea, newPosition);
      this.updateAttention();
    };

    // Make "Unpin from Overflow Menu" add widgets to the tab strip area
    // This function is mostly copied from the Firefox code, licensed under MPL 2.0
    // Original source: https://github.com/mozilla/gecko-dev/blob/6e8aa696b3484a183126aeb0ea2fdf95ad64461e/browser/components/customizableui/CustomizeMode.jsm#L687-L728
    gCustomizeMode.addToToolbar = async function (node, reason) {
      node = this._getCustomizableChildForNode(node);
      if (node.localName === 'toolbarpaletteitem' && node.firstElementChild) {
        node = node.firstElementChild;
      }

      let widgetAnimationPromise = this._promiseWidgetAnimationOut(node);
      let animationNode = widgetAnimationPromise ? await widgetAnimationPromise : undefined;

      let widgetToAdd = node.id;
      if (CustomizableUI.isSpecialWidget(widgetToAdd) && node.closest('#customization-palette')) {
        widgetToAdd = widgetToAdd.match(/^customizableui-special-(spring|spacer|separator)/)[1];
      }

      // These two lines have been changed so widget gets added to the tabs strip
      CustomizableUI.addWidgetToArea(widgetToAdd, CustomizableUI.AREA_TABSTRIP);
      lazy.BrowserUsageTelemetry.recordWidgetChange(widgetToAdd, CustomizableUI.AREA_TABSTRIP);

      if (!this._customizing) {
        CustomizableUI.dispatchToolboxEvent('customizationchange');
      }

      // If the user explicitly moves this item, turn off autohide
      if (node.id === 'downloads-button') {
        Services.prefs.setBoolPref(kDownloadAutoHidePref, false);
        if (this._customizing) this._showDownloadsAutoHidePanel();
      }

      if (animationNode) {
        animationNode.classList.remove('animate-out');
      }
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
    xPref.set('browser.sessionstore.max_resumed_crashes', 0, true);
    xPref.set('browser.sessionstore.max_tabs_undo', 0, true);
    xPref.set('browser.sessionstore.max_windows_undo', 0, true);
    xPref.set('browser.shell.checkDefaultBrowser', false, true);
    xPref.set('browser.startup.upgradeDialog.enabled', false, true);
    xPref.set('browser.aboutwelcome.enabled', false, true);
    xPref.set('browser.messaging-system.whatsNewPanel.enabled', false, true);
    xPref.set('browser.privateWindowSeparation.enabled', false, true);
    xPref.set('browser.privacySegmentation.createdShortcut', true, true);
    xPref.set('browser.startup.homepage', 'about:blankhome', true);
    xPref.set('browser.newtabpage.enabled', false, true);
    xPref.set('browser.newtabpage.activity-stream.feeds.snippets', false, true);
    xPref.set('browser.newtabpage.activity-stream.feeds.topsites', false, true);
    xPref.set('browser.newtabpage.activity-stream.feeds.section.topstories', false, true);
    xPref.set('browser.newtabpage.activity-stream.feeds.section.highlights', false, true);
    xPref.set('browser.uidensity', 1, true);
    xPref.set('browser.link.open_newwindow', 1, true);
    xPref.set('datareporting.policy.firstRunURL', '', true);
    xPref.set('termsofuse.bypassNotification', true, true);

    // Prevent syncing preferences that are commonly set to different values in web apps
    // In the future, we could try to implement a different syncing "channel" just for web apps
    xPref.set('services.sync.prefs.sync.browser.startup.page', false, true);
    xPref.set('services.sync.prefs.sync.browser.tabs.warnOnClose', false, true);
    xPref.set('services.sync.prefs.sync.browser.link.open_newwindow', false, true);

    // Prevent syncing preferences that are known to cause problems in web apps
    xPref.set('services.sync.prefs.sync.browser.startup.homepage', false, true);
    xPref.set('services.sync.prefs.sync.browser.newtabpage.enabled', false, true);
    xPref.set('services.sync.prefs.sync.browser.newtabpage.activity-stream.feeds.snippets', false, true);
    xPref.set('services.sync.prefs.sync.browser.newtabpage.activity-stream.feeds.topsites', false, true);
    xPref.set('services.sync.prefs.sync.browser.newtabpage.activity-stream.feeds.section.topstories', false, true);
    xPref.set('services.sync.prefs.sync.browser.newtabpage.activity-stream.feeds.section.highlights', false, true);

    // Reset preferences that might have been set to values known to cause problems
    // These values might have been incorrectly changed by users or because of sync
    // Might be removed in the future, once enough users have had this reset
    xPref.clear('browser.sessionstore.resume_from_crash');
    xPref.clear('browser.startup.upgradeDialog.enabled');
    xPref.clear('browser.aboutwelcome.enabled');
    xPref.clear('browser.messaging-system.whatsNewPanel.enabled');
    xPref.clear('browser.privateWindowSeparation.enabled');
    xPref.clear('browser.startup.homepage');
    xPref.clear('browser.newtabpage.enabled');
    xPref.clear('browser.newtabpage.activity-stream.feeds.snippets');
    xPref.clear('browser.newtabpage.activity-stream.feeds.topsites');
    xPref.clear('browser.newtabpage.activity-stream.feeds.section.topstories');
    xPref.clear('browser.newtabpage.activity-stream.feeds.section.highlights');

    // Set distribution details
    xPref.set('distribution.id', ChromeLoader.DISTRIBUTION_ID, true);
    xPref.set('distribution.version', ChromeLoader.DISTRIBUTION_VERSION, true);
    xPref.set('distribution.about', ChromeLoader.DISTRIBUTION_ABOUT, true);

    // Determines whether `_blank` links target is forced into the current tab or a new window
    // 0 - Do not change link behavior (not recommended)
    // 1 - Force links into the current tab (default)
    // 2 - Force links into a new window
    // 3 - Force links into a new tab
    xPref.set(ChromeLoader.PREF_LINKS_TARGET, 1, true);

    // Determines what happens when a web app is launched if the same web app is already opened
    // 0 - Open web app in a new window (default)
    // 1 - Open web app in a new tab
    // 2 - Replace the existing tab
    // 3 - Focus the existing window
    xPref.set(ChromeLoader.PREF_LAUNCH_TYPE, 0, true);

    // Determines whether URL bar is displayed always, when out-of-scope or never
    // 0 - Display URL bar when out-of-scope (default)
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

    // Determines whether out-of-scope URLs should be opened in a default browser
    xPref.set(ChromeLoader.PREF_OPEN_OUT_OF_SCOPE_IN_DEFAULT_BROWSER, false, true);

    // Determines whether the tabs mode is enabled
    xPref.set(ChromeLoader.PREF_ENABLE_TABS_MODE, false, true);

    // Determines whether hiding icon bar is allowed and option is displayed in the customize page
    xPref.set(ChromeLoader.PREF_ENABLE_HIDING_ICON_BAR, false, true);

    // Determines whether native window controls should be displayed even when using lwtheme
    // Only has effect on Linux with CSD enabled
    xPref.set(ChromeLoader.PREF_ALWAYS_USE_NATIVE_WINDOW_CONTROLS, false, true);

    // Determines which domains should always be allowed to open in the app browser
    // This is a comma-separated list of domains
    xPref.set(ChromeLoader.PREF_ALLOWED_DOMAINS, '', true);

    // Determines whether specific shortcuts are enabled or not
    xPref.set(ChromeLoader.PREF_SHORTCUTS_CLOSE_TAB, true, true);
    xPref.set(ChromeLoader.PREF_SHORTCUTS_CLOSE_WINDOW, true, true);
    xPref.set(ChromeLoader.PREF_SHORTCUTS_QUIT_APPLICATION, true, true);
    xPref.set(ChromeLoader.PREF_SHORTCUTS_PRIVATE_BROWSING, true, true);

    // Migration from the old "open in existing window" preference
    if (xPref.get(ChromeLoader.PREF_OPEN_IN_EXISTING_WINDOW)) {
      xPref.clear(ChromeLoader.PREF_OPEN_IN_EXISTING_WINDOW);
      xPref.set(ChromeLoader.PREF_LAUNCH_TYPE, 1);
    }
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
   * @param {ChromeWindow&Window} [target] A window to check.
   *
   * @returns {boolean} Whether this PWA can load the URI.
   */
  canLoad (uri, target = null) {
    if (!target) target = window;

    if (!uri || uri.spec === 'about:blank') return true;
    if (!target.gFFPWASiteConfig) return false;

    const scope = lazy.ioService.newURI(target.gFFPWASiteConfig.manifest.scope);

    if (scope.prePath !== uri.prePath) return false;
    return uri.filePath.startsWith(scope.filePath);
  }
}

window.gFFPWABrowser = new PwaBrowser();
