import { describe, expect, it } from 'vitest'
import { createScale, clampPxPerSecond } from '../../src/timeline/scale.js'
import { MAX_PX_PER_SECOND, MIN_PX_PER_SECOND } from '../../src/timeline/constants.js'

/**
 * Time to track space and back, losslessly.
 *
 * A lossy conversion is a drag that lands somewhere other than where it was released, and
 * it would show up as a one-millisecond drift nobody could reproduce. The round trip is
 * asserted over every millisecond of a slide rather than at a few sample points, because
 * the failures of a rounding scheme are not evenly distributed.
 */

describe('createScale', () => {
  it('round-trips every millisecond of an eight-second slide', () => {
    for (const pxPerSecond of [MIN_PX_PER_SECOND, 100, 240, MAX_PX_PER_SECOND]) {
      const scale = createScale(pxPerSecond)
      for (let ms = 0; ms <= 8000; ms += 1) {
        expect(scale.toMs(scale.toPx(ms)), `${pxPerSecond} px/s at ${ms} ms`).toBe(ms)
      }
    }
  })

  it('is linear and starts at zero', () => {
    const scale = createScale(100)
    expect(scale.toPx(0)).toBe(0)
    expect(scale.toPx(1000)).toBe(100)
    expect(scale.toPx(2000)).toBe(200)
  })

  it('returns whole milliseconds, because the format stores integers', () => {
    const scale = createScale(37)
    for (const px of [0, 1, 7.5, 33.3, 199.9]) {
      expect(Number.isInteger(scale.toMs(px))).toBe(true)
    }
  })

  it('never returns a negative time, however far left the pointer went', () => {
    const scale = createScale(100)
    expect(scale.toMs(-500)).toBe(0)
  })
})

describe('clampPxPerSecond', () => {
  it('bounds to the stated range', () => {
    expect(clampPxPerSecond(1)).toBe(MIN_PX_PER_SECOND)
    expect(clampPxPerSecond(10_000)).toBe(MAX_PX_PER_SECOND)
    expect(clampPxPerSecond(240)).toBe(240)
  })

  it('survives a nonsense input rather than producing a scale that divides by zero', () => {
    expect(clampPxPerSecond(0)).toBe(MIN_PX_PER_SECOND)
    expect(clampPxPerSecond(Number.NaN)).toBe(MIN_PX_PER_SECOND)
  })
})

describe('changing the scale preserves the moment, not the pixel (FR-007)', () => {
  it('maps one time to different pixels without the time changing', () => {
    // The playhead's *time* is the stored value; its position is computed from it. This is
    // also what makes the mid-drag rescale edge case fall out for free: a drag is expressed
    // in milliseconds throughout, so the pixel it started from is never consulted again.
    const moment = 3210
    const before = createScale(100).toPx(moment)
    const after = createScale(400).toPx(moment)
    expect(before).not.toBe(after)
    expect(createScale(100).toMs(before)).toBe(moment)
    expect(createScale(400).toMs(after)).toBe(moment)
  })
})

describe('a slide of zero duration', () => {
  /**
   * Legal: `Slide.durationMs` is `msInt` — integer ≥ 0, not the positive `msDuration` an
   * earlier draft of the data model assumed — and a slide advancing `on_click` has no
   * reason to carry one. The ruler has no width to draw. That must be uneventful rather
   * than a division by zero, and the round trip over "every millisecond in the slide" is
   * vacuous rather than silently skipped.
   */
  it('draws a zero-width ruler without dividing by zero', () => {
    const scale = createScale(100)
    expect(scale.toPx(0)).toBe(0)
    expect(Number.isFinite(scale.toPx(0))).toBe(true)
  })

  it('has exactly one millisecond to round-trip, and it is zero', () => {
    const scale = createScale(100)
    const durationMs = 0
    const checked: number[] = []
    for (let ms = 0; ms <= durationMs; ms += 1) {
      expect(scale.toMs(scale.toPx(ms))).toBe(ms)
      checked.push(ms)
    }
    // Asserted so the vacuity is visible: a loop that ran zero times would pass silently.
    expect(checked).toEqual([0])
  })
})

describe('toMsDelta', () => {
  it('is signed, because a drag leftwards is a negative delta', () => {
    const scale = createScale(100)
    expect(scale.toMsDelta(100)).toBe(1000)
    expect(scale.toMsDelta(-100)).toBe(-1000)
  })

  it('is whole milliseconds, like everything else the format stores', () => {
    const scale = createScale(37)
    expect(Number.isInteger(scale.toMsDelta(13.7))).toBe(true)
  })

  it('round-trips against toPx for a positive delta', () => {
    const scale = createScale(240)
    for (const ms of [1, 50, 999, 8000]) {
      expect(scale.toMsDelta(scale.toPx(ms))).toBe(ms)
    }
  })
})
