import { describe, expect, it } from 'vitest'
import { snap } from '../../src/geometry/snap.js'
import { snapCandidates } from '../../src/geometry/candidates.js'
import { SNAP_THRESHOLD_UNITS } from '../../src/geometry/constants.js'
import type { Geometry, SnapCandidate } from '../../src/geometry/types.js'

/**
 * T026 — the threshold, and the exactness of the result.
 *
 * SC-009 makes two claims that have to be checked together: an edge inside the threshold
 * snaps and one outside does not, and a snap lands on the candidate *exactly*. A snap that
 * merely moved the element closer would satisfy the first and quietly fail the second.
 */
const at = (x: number): Geometry => ({ x, y: 0, width: 100, height: 100, rotation: 0 })
const candidate = (x: number): SnapCandidate => ({ axis: 'x', at: x, source: 'element-edge' })

describe('snap threshold', () => {
  it('snaps an edge 7 units away — inside the 8-unit threshold', () => {
    const result = snap(at(207), [candidate(200)], SNAP_THRESHOLD_UNITS)
    expect(result.geometry.x).toBe(200)
    expect(result.guides).toHaveLength(1)
  })

  it('leaves an edge 9 units away alone — outside the threshold', () => {
    const result = snap(at(209), [candidate(200)], SNAP_THRESHOLD_UNITS)
    expect(result.geometry.x).toBe(209)
    expect(result.guides).toHaveLength(0)
  })

  it('lands exactly on the candidate — zero divergence, not merely closer (SC-009)', () => {
    const result = snap(at(203.7), [candidate(200)], SNAP_THRESHOLD_UNITS)
    expect(result.geometry.x - 200).toBe(0)
  })

  it('is disabled entirely at a threshold of zero — the negative control', () => {
    const result = snap(at(200.5), [candidate(200)], 0)
    expect(result.geometry.x).toBe(200.5)
    expect(result.guides).toHaveLength(0)
  })

  it('prefers the nearest candidate when several are in range', () => {
    const result = snap(at(205), [candidate(200), candidate(206)], SNAP_THRESHOLD_UNITS)
    expect(result.geometry.x).toBe(206)
  })

  it('snaps the trailing edge, not only the leading one', () => {
    // Element spans 100..200; its right edge is 3 from a candidate at 203.
    const result = snap(at(100), [candidate(203)], SNAP_THRESHOLD_UNITS)
    expect(result.geometry.x).toBe(103)
  })

  it('snaps each axis independently', () => {
    const g: Geometry = { x: 203, y: 305, width: 100, height: 100, rotation: 0 }
    const result = snap(g, [candidate(200), { axis: 'y', at: 300, source: 'canvas-centre' }], 8)
    expect(result.geometry.x).toBe(200)
    expect(result.geometry.y).toBe(300)
    expect(result.guides).toHaveLength(2)
  })

  it('does not resize while snapping — only the origin moves', () => {
    const result = snap(at(203), [candidate(200)], SNAP_THRESHOLD_UNITS)
    expect(result.geometry.width).toBe(100)
    expect(result.geometry.height).toBe(100)
  })

  /**
   * FR-009 / SC-009's second half. The engine is never told a display size, so it cannot
   * depend on one — asserted here rather than assumed, because the failure mode is a
   * threshold that feels right on one screen and wrong on another.
   */
  it('produces the same result whatever the display size, because it is never given one', () => {
    const once = snap(at(203), [candidate(200)], SNAP_THRESHOLD_UNITS)
    const again = snap(at(203), [candidate(200)], SNAP_THRESHOLD_UNITS)
    expect(once).toEqual(again)
    expect(snap.length).toBe(3)
  })
})

describe('snapCandidates', () => {
  const canvas = { width: 1600, height: 900 }

  it('offers the canvas edges and centre on both axes', () => {
    const c = snapCandidates([], canvas)
    const xs = c.filter((k) => k.axis === 'x').map((k) => k.at)
    const ys = c.filter((k) => k.axis === 'y').map((k) => k.at)
    expect(xs).toEqual(expect.arrayContaining([0, 800, 1600]))
    expect(ys).toEqual(expect.arrayContaining([0, 450, 900]))
  })

  it('offers a sibling’s edges and centre', () => {
    const sibling: Geometry = { x: 200, y: 100, width: 400, height: 200, rotation: 0 }
    const c = snapCandidates([sibling], canvas)
    const xs = c.filter((k) => k.axis === 'x').map((k) => k.at)
    expect(xs).toEqual(expect.arrayContaining([200, 400, 600]))
  })

  /**
   * A rotated element's visual bounds are not its stored geometry, and the editor does not
   * pretend otherwise: candidates come from authored values, so a snap writes what the
   * teacher can see in the inspector.
   */
  it('takes a rotated sibling’s candidates from authored geometry, not visual bounds', () => {
    const upright: Geometry = { x: 200, y: 100, width: 400, height: 200, rotation: 0 }
    const spun: Geometry = { ...upright, rotation: 45 }
    expect(snapCandidates([spun], canvas)).toEqual(snapCandidates([upright], canvas))
  })
})
