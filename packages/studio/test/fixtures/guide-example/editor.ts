import type { ElementEditor } from '../../../src/registry/editors.js'

/**
 * The guide example's **third** piece, in a third package.
 *
 * Without it the type is absent from the Add menu — the quietest of the four failures, and the one a
 * teacher discovers rather than a test.
 *
 * Note what is *not* here: the field list. That comes from the plugin's `inspector` in
 * `@cuestack/core`, and this package overlays only the members that describe editing rather than the
 * field — `toStored`, `fromStored`, `itemDefaults`. A type whose editor restated its fields would
 * have two lists to keep in agreement.
 */
// #region editor
export const countdownEditor: ElementEditor = {
  type: 'countdown',
  defaults: {
    width: 200,
    height: 100,
    payload: { seconds: 30, announceFinal: true },
  },

  /**
   * Empty, and that is the interesting part.
   *
   * `inspector` is required here, but for a type with a registered plugin the *fields* come from the
   * plugin's `inspector` — `Inspector.tsx` takes the plugin's list and overlays only the three
   * members that describe editing rather than the field: `toStored`, `fromStored`, `itemDefaults`.
   * So a third-party type declares its fields once, in `@cuestack/core`, and puts an entry here only
   * when a field needs one of those transforms.
   *
   * Restating the field list here would give the type two lists to keep in agreement, which is the
   * failure the merge exists to prevent.
   */
  inspector: [],
}
// #endregion editor
