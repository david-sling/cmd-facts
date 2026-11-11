/**
 * The version of this package, written out rather than read: nothing here opens a file, and an import of
 * `package.json` would not load on every Node this runs on. A test holds it to the manifest, so a release that
 * forgets to move it does not publish.
 */
export const VERSION = '0.5.0'
