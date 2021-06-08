const EXPORTED_SYMBOLS = ['xPref'];

// File is mostly copied from xiaoxiaoflood/firefox-scripts repository on GitHub, licensed under MPL 2.0
// Original source: https://github.com/xiaoxiaoflood/firefox-scripts/blob/69675c7f09e9009b63b1cc239b94c03c5962a9d7/chrome/utils/xPref.jsm

const { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');

const xPref = {
  get: function (prefPath, def = false, valueIfUndefined, setDefault = true) {
    let sPrefs = def ? Services.prefs.getDefaultBranch(null) : Services.prefs;

    try {
      switch (sPrefs.getPrefType(prefPath)) {
        case 0:
          if (valueIfUndefined !== undefined) {
            return this.set(prefPath, valueIfUndefined, setDefault);
          } else {
            return undefined;
          }
        case 32:
          return sPrefs.getStringPref(prefPath);
        case 64:
          return sPrefs.getIntPref(prefPath);
        case 128:
          return sPrefs.getBoolPref(prefPath);
      }
    } catch (ex) {
      return undefined;
    }
  },

  set: function (prefPath, value, def = false) {
    let sPrefs = def ? Services.prefs.getDefaultBranch(null) : Services.prefs;

    switch (typeof value) {
      case 'string':
        return sPrefs.setCharPref(prefPath, value) || value;
      case 'number':
        return sPrefs.setIntPref(prefPath, value) || value;
      case 'boolean':
        return sPrefs.setBoolPref(prefPath, value) || value;
    }
  },

  lockedBackupDef: {},

  lock: function (prefPath, value) {
    let sPrefs = Services.prefs;
    this.lockedBackupDef[prefPath] = this.get(prefPath, true);

    if (sPrefs.prefIsLocked(prefPath)) {
      sPrefs.unlockPref(prefPath);
    }

    this.set(prefPath, value, true);
    sPrefs.lockPref(prefPath);
  },

  unlock: function (prefPath) {
    Services.prefs.unlockPref(prefPath);

    let bkp = this.lockedBackupDef[prefPath];
    if (bkp === undefined) {
      Services.prefs.deleteBranch(prefPath);
    } else {
      this.set(prefPath, bkp, true);
    }
  },

  clear: Services.prefs.clearUserPref,

  addListener: function (prefPath, trat) {
    this.observer = function (aSubject, aTopic, prefPath) {
      return trat(xPref.get(prefPath), prefPath);
    }

    Services.prefs.addObserver(prefPath, this.observer);

    return {
      prefPath: prefPath,
      observer: this.observer
    };
  },

  removeListener: function (obs) {
    Services.prefs.removeObserver(obs.prefPath, obs.observer);
  }
}
