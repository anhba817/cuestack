import { describe, expect, it } from 'vitest'
import { moveRange, resizeRangeEnd, resizeRangeStart, snapTargetsFor } from '../../src/timeline/timing.js'
import { MIN_ELEMENT_DURATION_MS, SNAP_THRESHOLD_MS } from '../../src/timeline/constants.js'
import { element, slide } from '../harness/corpus.js'
import { overlappingEffects } from '../harness/timeline.js'

/**
 * Moving and resizing a time range: pure, milliseconds in and milliseconds out.
 *
 * **Not a reuse of `geometry/transform.ts`**, and the temptation was real — a bar looks like
 * a rectangle. Time is one-dimensional, its unit is an integer millisecond where geometry's
 * is a finite float, its floor is zero where geometry's is a minimum extent, and it snaps to
 * other events' boundaries rather than to edges and centres. Sharing the code would have
 * given the geometry module knowledge of milliseconds, which is how a general helper stops
 * being either (research R-07).
 *
 * What *is* shared is the shape: clamped so the reducer can never be handed something the
 * schema rejects, and tested with no DOM at all.
 */

const range = (startMs: number, endMs: number) => ({ startMs, endMs })
const none: readonly number[] = []

describe('moveRange', () => {
  it('moves start and end together, leaving the duration unchanged (FR-012)', () => {
    const moved = moveRange(range(1000, 3000), 500, none)
    expect(moved).toEqual({ startMs: 1500, endMs: 3500 })
    expect(moved.endMs - moved.startMs).toBe(2000)
  })

  it('moves backwards as readily as forwards', () => {
    expect(moveRange(range(2000, 5000), -1500, none)).toEqual({ startMs: 500, endMs: 3500 })
  })

  it('stops at zero and keeps its duration (edge case)', () => {
    // Not "clamps the start to zero and leaves the end where it was", which would silently
    // shorten the element. A drag that runs out of room stops; it does not resize.
    const moved = moveRange(range(1000, 4000), -5000, none)
    expect(moved).toEqual({ startMs: 0, endMs: 3000 })
  })

  it('returns non-negative integers whatever it is given (BR-001, BR-002)', () => {
    for (const delta of [0.4, -0.4, 123.456, -9999.9]) {
      const moved = moveRange(range(1000, 2000), delta, none)
      expect(Number.isInteger(moved.startMs)).toBe(true)
      expect(Number.isInteger(moved.endMs)).toBe(true)
      expect(moved.startMs).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('resizing one edge alone (FR-013)', () => {
  it('changes the start and not the end', () => {
    expect(resizeRangeStart(range(1000, 4000), -400, none)).toEqual({ startMs: 600, endMs: 4000 })
  })

  it('changes the end and not the start', () => {
    expect(resizeRangeEnd(range(1000, 4000), 750, none)).toEqual({ startMs: 1000, endMs: 4750 })
  })

  it('never lets the start cross the end', () => {
    const resized = resizeRangeStart(range(1000, 2000), 5000, none)
    expect(resized.endMs - resized.startMs).toBe(MIN_ELEMENT_DURATION_MS)
    expect(resized.endMs).toBe(2000)
  })

  it('never lets the end cross the start', () => {
    const resized = resizeRangeEnd(range(1000, 2000), -5000, none)
    expect(resized.endMs - resized.startMs).toBe(MIN_ELEMENT_DURATION_MS)
    expect(resized.startMs).toBe(1000)
  })

  it('holds the floor the schema sets: endMs must exceed startMs', () => {
    // `elementSchema` refines `endMs > startMs`, so one millisecond is the shortest legal
    // element. Clamping here is what keeps a live drag from ever producing a draft the
    // reducer would have to refuse.
    for (const delta of [-1, -2, -100, -100_000]) {
      const resized = resizeRangeEnd(range(500, 501), delta, none)
      expect(resized.endMs).toBeGreaterThan(resized.startMs)
    }
  })
})

describe('snapping (FR-015)', () => {
  const targets = [2000, 5000]

  it('lands exactly on a target within the threshold', () => {
    const near = 2000 - (SNAP_THRESHOLD_MS - 10)
    expect(moveRange(range(near, near + 1000), 0, targets).startMs).toBe(2000)
  })

  it('leaves a target outside the threshold alone', () => {
    const far = 2000 - (SNAP_THRESHOLD_MS + 10)
    expect(moveRange(range(far, far + 1000), 0, targets).startMs).toBe(far)
  })

  it('snaps the end as readily as the start', () => {
    const start = 5000 - 1000 - (SNAP_THRESHOLD_MS - 20)
    expect(moveRange(range(start, start + 1000), 0, targets).endMs).toBe(5000)
  })

  it('is disabled entirely at a threshold of zero — the negative control', () => {
    const near = 1995
    expect(moveRange(range(near, near + 500), 0, targets, { snapThresholdMs: 0 }).startMs).toBe(near)
  })

  it('resizing snaps too, and still respects the floor', () => {
    const resized = resizeRangeEnd(range(1000, 1960), 0, targets)
    expect(resized.endMs).toBe(2000)
    expect(resized.startMs).toBe(1000)
  })
})

describe('snapTargetsFor', () => {
  it('collects every other event’s start and end, plus the slide’s bounds', () => {
    const a = element({ startMs: 1000, endMs: 3000 })
    const b = element({ startMs: 4000, endMs: 6000 })
    const targets = snapTargetsFor(slide([a, b], { durationMs: 8000 }), a.id)

    expect(targets).toContain(0)
    expect(targets).toContain(8000)
    expect(targets).toContain(4000)
    expect(targets).toContain(6000)
  })

  it('never lets an event snap to itself', () => {
    const a = element({ startMs: 1000, endMs: 3000 })
    const targets = snapTargetsFor(slide([a], { durationMs: 8000 }), a.id)
    expect(targets).not.toContain(1000)
    expect(targets).not.toContain(3000)
  })

  it('includes effect boundaries, because an effect is an event too', () => {
    const owner = overlappingEffects()
    const other = element({ startMs: 4000, endMs: 5000 })
    const targets = snapTargetsFor(slide([owner, other], { durationMs: 8000 }), other.id)
    // The fixture's effects run [0, 1000) and [500, 1500).
    expect(targets).toContain(1000)
    expect(targets).toContain(1500)
  })

  it('is sorted and free of duplicates, so the nearest target is unambiguous', () => {
    const a = element({ startMs: 0, endMs: 8000 })
    const b = element({ startMs: 0, endMs: 8000 })
    const targets = snapTargetsFor(slide([a, b], { durationMs: 8000 }), a.id)
    expect(targets).toEqual([...new Set(targets)].sort((x, y) => x - y))
  })
})
