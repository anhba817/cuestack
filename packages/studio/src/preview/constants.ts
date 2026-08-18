/**
 * Viewport preset widths, in CSS pixels.
 *
 * **Chosen against the player's legibility floors, not against devices.** The lesson's
 * aspect ratio is fixed by its canvas — `.cs-stage` declares
 * `aspect-ratio: var(--cs-canvas-w) / var(--cs-canvas-h)` — and every dimension beneath it
 * is in `cqw`/`cqh` against that same canvas. So a narrower preview is the *same picture,
 * smaller*: nothing reflows, nothing repositions, no relative type size changes.
 *
 * The one thing that does change is `max(12px, …)` on type. Against the 16:9 canvas of
 * 1600 × 900, body text is `max(12px, 32 / 1600 * 100cqw)` = `max(12px, W / 50)`, so the
 * floor takes over below **600 px**; captions are `20 / 1600` → below **960 px**; UI text
 * `24 / 1600` → below **800 px**. Below those widths type stops shrinking with the canvas
 * and grows relative to the box it was authored in — which is the whole of what a preset
 * can show a teacher, and the reason FR-024 is a requirement rather than a nicety.
 *
 * A lesson with a different canvas has different floors: 9:16 is 900 wide, so its numbers
 * sit elsewhere. `floorsFor` derives them rather than restating these.
 */
export const PREVIEW_PRESETS = {
  /** Above every floor. The Constitution's authoring target, and the control case: a
   *  lesson here renders exactly as authored. */
  desktop: 1280,
  /** Below the caption floor (960) and above the body-text floor (600). Captions and UI
   *  labels are already larger than authored; body text is not. */
  tablet: 834,
  /** Below all three. The case a teacher opens this feature to check. */
  mobile: 390,
} as const

export type ViewportPreset = keyof typeof PREVIEW_PRESETS

export const PREVIEW_PRESET_ORDER: readonly ViewportPreset[] = ['desktop', 'tablet', 'mobile']

/**
 * The player's minimum rendered type size, in CSS pixels.
 *
 * Not a choice this package makes — it is `max(12px, …)` in `packages/react/src/styles/
 * stage.css`, restated here so the widths above can be checked against it rather than
 * asserted to be sensible.
 */
export const TYPE_FLOOR_PX = 12

/** The authored sizes the floor competes with, from the stage stylesheet's fallbacks. */
const AUTHORED = { body: 32, caption: 20, ui: 24 } as const

/**
 * The container width at which each authored size reaches the floor, for a given canvas.
 *
 * `authored / canvasWidth * W = TYPE_FLOOR_PX` solved for `W`. Below the returned width the
 * text stops shrinking; at or above it, the lesson renders in proportion.
 */
export function floorsFor(canvasWidth: number): { body: number; caption: number; ui: number } {
  const at = (authored: number): number => (TYPE_FLOOR_PX * canvasWidth) / authored
  return { body: at(AUTHORED.body), caption: at(AUTHORED.caption), ui: at(AUTHORED.ui) }
}
