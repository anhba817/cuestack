import { describe, expect, it } from 'vitest'
import { alignEdges, distributeEvenly } from '../../src/geometry/align.js'
import type { Geometry } from '../../src/geometry/types.js'

/** T028 — FR-006. Alignment needs two, distribution needs three. */
const g = (x: number, y: number, width = 100, height = 100): Geometry => ({
  x,
  y,
  width,
  height,
  rotation: 0,
})

describe('alignEdges', () => {
  it('aligns to the selection’s own extreme, not the canvas', () => {
    const out = alignEdges([g(300, 0), g(100, 0), g(500, 0)], 'left')
    expect(out.map((k) => k.x)).toEqual([100, 100, 100])
  })

  it('aligns right edges, accounting for differing widths', () => {
    const out = alignEdges([g(0, 0, 100), g(0, 0, 300)], 'right')
    expect(out.map((k) => k.x + k.width)).toEqual([300, 300])
  })

  it('aligns tops and bottoms', () => {
    expect(alignEdges([g(0, 40), g(0, 10)], 'top').map((k) => k.y)).toEqual([10, 10])
    expect(
      alignEdges([g(0, 0, 100, 50), g(0, 0, 100, 90)], 'bottom').map((k) => k.y + k.height),
    ).toEqual([90, 90])
  })

  it('centres on the midpoint of the selection’s span', () => {
    const out = alignEdges([g(0, 0, 100), g(200, 0, 100)], 'centre-x')
    // Span 0..300, centre 150; each 100 wide, so both sit at 100.
    expect(out.map((k) => k.x)).toEqual([100, 100])
  })

  it('preserves input order, so the result lines up with the selection', () => {
    const out = alignEdges([g(500, 0), g(100, 0)], 'left')
    expect(out).toHaveLength(2)
    expect(out.map((k) => k.width)).toEqual([100, 100])
  })

  it('changes only the axis it aligns', () => {
    const out = alignEdges([g(300, 77), g(100, 42)], 'left')
    expect(out.map((k) => k.y)).toEqual([77, 42])
  })
})

describe('distributeEvenly', () => {
  it('equalises the gaps between adjacent elements', () => {
    const out = distributeEvenly([g(0, 0, 100), g(150, 0, 100), g(400, 0, 100)], 'horizontal')
    const gaps = [out[1]!.x - (out[0]!.x + out[0]!.width), out[2]!.x - (out[1]!.x + out[1]!.width)]
    expect(gaps[0]).toBeCloseTo(gaps[1]!, 10)
  })

  it('leaves the outermost two where they were — they define the span', () => {
    const out = distributeEvenly([g(0, 0, 100), g(150, 0, 100), g(400, 0, 100)], 'horizontal')
    expect(out[0]!.x).toBe(0)
    expect(out[2]!.x + out[2]!.width).toBe(500)
  })

  it('equalises gaps rather than centres, which differs whenever sizes differ', () => {
    const out = distributeEvenly([g(0, 0, 100), g(200, 0, 300), g(700, 0, 100)], 'horizontal')
    const gaps = [out[1]!.x - 100, out[2]!.x - (out[1]!.x + 300)]
    expect(gaps[0]).toBeCloseTo(gaps[1]!, 10)
  })

  it('distributes vertically on the other axis', () => {
    const out = distributeEvenly([g(0, 0), g(0, 150), g(0, 400)], 'vertical')
    const gaps = [out[1]!.y - 100, out[2]!.y - (out[1]!.y + 100)]
    expect(gaps[0]).toBeCloseTo(gaps[1]!, 10)
  })

  it('returns the input unchanged below three — the reducer refuses, it does not silently no-op', () => {
    const two = [g(0, 0), g(400, 0)]
    expect(distributeEvenly(two, 'horizontal')).toEqual(two)
  })

  it('sorts by position but returns in the caller’s order', () => {
    const out = distributeEvenly([g(400, 0, 100), g(0, 0, 100), g(150, 0, 100)], 'horizontal')
    expect(out[1]!.x).toBe(0)
    expect(out[0]!.x + out[0]!.width).toBe(500)
  })
})
