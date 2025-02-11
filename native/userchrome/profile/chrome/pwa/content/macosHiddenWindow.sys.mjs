import { sanitizeString } from 'resource://pwa/utils/common.sys.mjs';

function OpenPwaShortcut(url) {
  switchToTabHavingURI(url, true);
}

class MacOSHiddenWindow {
  constructor() {
    this.setupDock();
  }

  setupDock() {
    const mainWindow = Services.wm.getMostRecentWindow('navigator:browser');
    const dockMenu = document.getElementById('menu_mac_dockmenu');
    const { shortcuts = [] } = mainWindow.gFFPWASiteConfig.manifest;

    Array.from(dockMenu.children).forEach((child) => {
      dockMenu.removeChild(child);
    });

    shortcuts.forEach((item) => {
      const menuItem = document.createXULElement('menuitem');

      menuItem.setAttribute('label', sanitizeString(item.name));

      menuItem.addEventListener('command', () => {
        OpenPwaShortcut(sanitizeString(item.url));
      });

      dockMenu.appendChild(menuItem);
    });
  }
}

new MacOSHiddenWindow();
