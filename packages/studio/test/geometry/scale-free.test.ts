import { describe, expect, it } from 'vitest'
import { moveBy, resizeBy, rotateBy } from '../../src/geometry/transform.js'
import { snap } from '../../src/geometry/snap.js'
import { snapCandidates } from '../../src/geometry/candidates.js'
import { alignEdges, distributeEvenly } from '../../src/geometry/align.js'
import type { Geometry } from '../../src/geometry/types.js'

/**
 * T025 — FR-004, FR-009, SC-009: the engine cannot depend on a display size.
 *
 * Not asserted by comparing two display sizes, which would require inventing one. Asserted
 * structurally: no function here accepts a scale, a viewport, or an element, and this suite
 * runs where `document` does not exist. If any of them ever needs a display size, the
 * signature has to change and this test is what notices.
 *
 * The distinction that makes this honest: converting a *pointer* position to logical units
 * genuinely needs the rendered size, and that conversion lives in `canvas/pointer.ts` at the
 * input edge, measured once per gesture. Nothing on this path measures anything.
 */
const g: Geometry = { x: 100, y: 100, width: 200, height: 200, rotation: 0 }

describe('the geometry engine is scale-free', () => {
  it('runs where there is no DOM at all', () => {
    expect(typeof globalThis.document).toBe('undefined')
  })

  it('takes no scale, viewport, or element in any signature', () => {
    // arity: (geometry, dx, dy) / (geometry, handle, dx, dy) / (geometry, degrees)
    expect(moveBy.length).toBe(3)
    expect(resizeBy.length).toBe(4)
    expect(rotateBy.length).toBe(2)
    // (geometry, candidates, threshold) — the threshold is logical units, not pixels.
    expect(snap.length).toBe(3)
    // (others, canvas) — the *logical* canvas, which is a manifest property.
    expect(snapCandidates.length).toBe(2)
    expect(alignEdges.length).toBe(2)
    expect(distributeEvenly.length).toBe(2)
  })

  it('gives the same result for the same logical delta, every time', () => {
    const once = moveBy(g, 37, -19)
    const again = moveBy(g, 37, -19)
    expect(once).toEqual(again)
    expect(once).toEqual({ ...g, x: 137, y: 81 })
  })

  it('is expressed entirely in the units the manifest stores', () => {
    // A 1-unit nudge moves exactly one unit — the manifest's own unit, not a pixel that
    // happens to look like one at some particular zoom.
    expect(moveBy(g, 1, 0).x - g.x).toBe(1)
    expect(resizeBy(g, 'se', 1, 0).width - g.width).toBe(1)
  })
})
