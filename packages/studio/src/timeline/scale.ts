import { MAX_PX_PER_SECOND, MIN_PX_PER_SECOND } from './constants.js'

export interface TimeScale {
  /** Lesson time to track-space pixels. */
  toPx(ms: number): number
  /** Track-space pixels to lesson time, as a non-negative whole millisecond. */
  toMs(px: number): number
  /**
   * A pixel *delta* to a millisecond delta — signed, and not clamped at zero.
   *
   * Separate from `toMs` because a drag leftwards is a negative delta and clamping it would
   * silently turn "move earlier" into "do not move". `toMs` clamps because a *position*
   * before the start of the slide is not a moment; a *delta* of −400 ms is.
   *
   * Note what this does not need: a measurement. Track space is CSS pixels, so a pointer
   * delta is already in the units this converts from — unlike the canvas, whose logical
   * units require the stage's rendered width and are why `canvas/pointer.ts` exists.
   */
  toMsDelta(px: number): number
  readonly pxPerSecond: number
}

/**
 * Keep a scale inside the range where the timeline is usable.
 *
 * Also the guard against nonsense: zero would make `toMs` divide by zero, and `NaN` would
 * poison every position on the ruler with a value that compares false against itself.
 */
export function clampPxPerSecond(value: number): number {
  if (!Number.isFinite(value)) return MIN_PX_PER_SECOND
  return Math.min(MAX_PX_PER_SECOND, Math.max(MIN_PX_PER_SECOND, value))
}

/**
 * The conversion between lesson time and track space, and nothing else.
 *
 * Pure and total: `toMs(toPx(ms)) === ms` for every millisecond of a slide, asserted over
 * the whole range rather than at sample points, because rounding schemes fail unevenly. A
 * lossy conversion here is a drag that lands somewhere other than where it was released —
 * a one-millisecond drift nobody could reproduce.
 *
 * **Changing the scale preserves the moment, not the pixel** (FR-007). The playhead's time
 * is the stored value and its position is computed from it, which is also what makes the
 * mid-drag rescale edge case fall out for free: a drag is expressed in milliseconds
 * throughout, so the pixel it began at is never consulted again.
 *
 * A slide of zero duration is legal — `Slide.durationMs` is `msInt`, integer ≥ 0 — and
 * produces a ruler of zero width. That must be uneventful, which is why nothing here
 * divides by a duration.
 */
export function createScale(pxPerSecond: number): TimeScale {
  const rate = clampPxPerSecond(pxPerSecond)
  return {
    pxPerSecond: rate,
    toPx: (ms) => (ms * rate) / 1000,
    toMs: (px) => Math.max(0, Math.round((px * 1000) / rate)),
    toMsDelta: (px) => Math.round((px * 1000) / rate),
  }
}
