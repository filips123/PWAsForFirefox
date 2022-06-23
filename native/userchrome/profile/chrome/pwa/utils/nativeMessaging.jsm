const EXPORTED_SYMBOLS = ['sendNativeMessage'];

const { XPCOMUtils } = ChromeUtils.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetters(this, {
  ExtensionCommon: 'resource://gre/modules/ExtensionCommon.jsm',
  NativeApp: 'resource://gre/modules/NativeMessaging.jsm',
});

/**
 * A custom extension context that "emulates" our main extension.
 */
class UserChromeContext extends ExtensionCommon.BaseContext {
  constructor () {
    super('userChromeEnv', { id: 'firefoxpwa@filips.si', manifestVersion: 2 });
    this.sandbox = Cu.Sandbox(globalThis);
  }

  logActivity (type, name, data) {
    console.log('[UserChromeContext]', type, name, data);
  }

  get cloneScope () {
    return this.sandbox;
  }

  get principal () {
    return Cu.getObjectPrincipal(this.sandbox);
  }
}
/**
 * Send a message to the native program and return response.
 *
 * @param {Object} message - The message to send
 *
 * @returns {Promise<Object>} The response from the native program
 * @throws {Error} If sending the message failed
 */
function sendNativeMessage(message) {
  const userChromeContext = new UserChromeContext();
  const nativeMessage = NativeApp.encodeMessage(userChromeContext, message);
  const nativeApp = new NativeApp(userChromeContext, 'firefoxpwa');
  return nativeApp.sendMessage(new StructuredCloneHolder(nativeMessage))
}
