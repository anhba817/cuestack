import { describe, expect, it } from 'vitest'
import { scaleOf, toLogicalDelta } from '../../src/canvas/pointer.js'

/**
 * T033 — the input edge, tested with the scale injected rather than measured.
 *
 * The split this suite exists to prove: `toLogicalDelta` is arithmetic and can be checked
 * exhaustively; `scaleOf` is the one measurement, and under happy-dom it returns null because
 * there is no layout. Asserting that null explicitly is worth more than mocking a rect —
 * a mocked layout engine would only ever confirm the mock (research R-04).
 */
describe('toLogicalDelta', () => {
  it('divides screen pixels by the scale', () => {
    expect(toLogicalDelta(100, 50, 0.5)).toEqual({ dx: 200, dy: 100 })
  })

  it('is the identity at 1:1', () => {
    expect(toLogicalDelta(37, -19, 1)).toEqual({ dx: 37, dy: -19 })
  })

  it('carries sign through, so dragging up moves up', () => {
    expect(toLogicalDelta(-40, -80, 2)).toEqual({ dx: -20, dy: -40 })
  })

  it('refuses to convert against a scale that is not usable', () => {
    // Rather than emitting Infinity or NaN into a geometry the reducer would then write.
    expect(toLogicalDelta(100, 100, 0)).toEqual({ dx: 0, dy: 0 })
    expect(toLogicalDelta(100, 100, Number.NaN)).toEqual({ dx: 0, dy: 0 })
    expect(toLogicalDelta(100, 100, -1)).toEqual({ dx: 0, dy: 0 })
  })

  it('takes the scale as an argument and never discovers it', () => {
    expect(toLogicalDelta.length).toBe(3)
  })
})

describe('scaleOf', () => {
  const canvas = { width: 1600, height: 900 }

  it('returns null where there is no layout, rather than dividing by zero', () => {
    const stage = document.createElement('div')
    document.body.appendChild(stage)
    // happy-dom computes no layout: this rect is all zeros, which is precisely why the
    // geometry engine must never depend on one.
    expect(stage.getBoundingClientRect().width).toBe(0)
    expect(scaleOf(stage, canvas)).toBeNull()
  })

  it('divides rendered width by logical width when a layout exists', () => {
    // Stands in for a browser that has laid the stage out at 800 CSS pixels.
    const stage = { getBoundingClientRect: () => ({ width: 800 }) } as unknown as Element
    expect(scaleOf(stage, canvas)).toBe(0.5)
  })

  it('refuses a degenerate canvas', () => {
    const stage = { getBoundingClientRect: () => ({ width: 800 }) } as unknown as Element
    expect(scaleOf(stage, { width: 0, height: 0 })).toBeNull()
  })

  it('round-trips: a 100px drag at half scale is 200 logical units', () => {
    const stage = { getBoundingClientRect: () => ({ width: 800 }) } as unknown as Element
    const scale = scaleOf(stage, canvas)!
    expect(toLogicalDelta(100, 0, scale).dx).toBe(200)
  })
})
