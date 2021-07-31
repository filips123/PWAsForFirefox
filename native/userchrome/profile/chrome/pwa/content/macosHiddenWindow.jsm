function OpenPwaShortcut(url) {
  const window = Services.wm.getMostRecentWindow('navigator:browser');
  window.switchToTabHavingURI(url, true);
}

class MacOSHiddenWindow {
  constructor() {
    this.setupDock();
  }

  setupDock() {
    const mainWindow = Services.wm.getMostRecentWindow('navigator:browser');
    const dockMenu = document.getElementById('menu_mac_dockmenu');
    const { shortcuts = [] } = mainWindow.gFFPWASiteConfig.manifest;
    const [defaultChild] = dockMenu.children;

    Array.from(dockMenu.children).forEach((child) => {
      dockMenu.removeChild(child);
    });

    shortcuts.forEach((item) => {
      const menuItem = defaultChild.cloneNode();

      menuItem.setAttribute('oncommand', `OpenPwaShortcut("${item.url}");`);
      menuItem.setAttribute('label', item.name);

      dockMenu.appendChild(menuItem);
    });
  }
}

new MacOSHiddenWindow();
