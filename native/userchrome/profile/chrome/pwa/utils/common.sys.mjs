/**
 * Removes all control characters from the string.
 *
 * @param {string?} string
 *
 * @returns {string|undefined}
 */
export function sanitizeString (string) {
  return string?.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

/**
 * Imports a module using the moz-src URI, falling back to a resource URI if the import fails.
 *
 * Source: https://searchfox.org/firefox-main/rev/b4b9efb6ee130740a94caf46ffff0625af1d51db/browser/extensions/newtab/lib/ImportHelper.sys.mjs
 *
 * @param {string} module - The full `moz-src` URI to import.
 * @param {string} [fallbackResourcePath] - The `resource` URL prefix to use for fallback import if `moz-src` fails. The helper will suffix *only* the module filename to this path.
 */
export function importModule (module, fallbackResourcePath = 'resource:///modules/') {
  try {
    return ChromeUtils.importESModule(module);
  } catch {
    let baseName = module.split('/').pop();
    return ChromeUtils.importESModule(fallbackResourcePath + baseName);
  }
}
