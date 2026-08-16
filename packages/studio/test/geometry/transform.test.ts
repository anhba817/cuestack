import { describe, expect, it } from 'vitest'
import { moveBy, resizeBy, rotateBy } from '../../src/geometry/transform.js'
import { MIN_EXTENT_UNITS } from '../../src/geometry/constants.js'
import type { Geometry } from '../../src/geometry/types.js'

/**
 * T024 — the transform engine, with no DOM in sight.
 *
 * This suite runs in the node project, where there is no `document` to reach for. That is
 * the point: happy-dom computes no layout, so drag logic that derived geometry from a
 * measured rect would be untestable here and would arrive either mocking a layout engine or
 * with no tests at all (research R-04).
 */
const base: Geometry = { x: 100, y: 200, width: 400, height: 300, rotation: 0 }

describe('moveBy', () => {
  it('translates in logical units', () => {
    expect(moveBy(base, 50, -25)).toEqual({ ...base, x: 150, y: 175 })
  })

  it('leaves size and rotation alone', () => {
    const moved = moveBy({ ...base, rotation: 30 }, 10, 10)
    expect(moved.width).toBe(base.width)
    expect(moved.height).toBe(base.height)
    expect(moved.rotation).toBe(30)
  })

  /**
   * Edge case #1. An element may legitimately start off-stage and slide in, so the
   * transform must not clamp to the canvas — the obvious implementation does, and silently
   * breaks a pattern the format supports.
   */
  it('permits geometry outside the canvas and never clamps it back', () => {
    expect(moveBy(base, -1000, -1000)).toEqual({ ...base, x: -900, y: -800 })
    expect(moveBy(base, 99_999, 0).x).toBe(100_099)
  })
})

describe('resizeBy', () => {
  it('grows from the south-east handle without moving the origin', () => {
    expect(resizeBy(base, 'se', 100, 50)).toEqual({ ...base, width: 500, height: 350 })
  })

  it('grows from the north-west handle by moving the origin', () => {
    expect(resizeBy(base, 'nw', -100, -50)).toEqual({
      ...base,
      x: 0,
      y: 150,
      width: 500,
      height: 350,
    })
  })

  it('constrains a single-axis handle to that axis', () => {
    expect(resizeBy(base, 'e', 60, 999)).toEqual({ ...base, width: 460 })
    expect(resizeBy(base, 's', 999, 60)).toEqual({ ...base, height: 360 })
  })

  it('clamps at the minimum extent rather than producing a manifest the schema rejects', () => {
    const collapsed = resizeBy(base, 'se', -10_000, -10_000)
    expect(collapsed.width).toBe(MIN_EXTENT_UNITS)
    expect(collapsed.height).toBe(MIN_EXTENT_UNITS)
    expect(collapsed.width).toBeGreaterThan(0)
  })

  it('stops the origin moving past the far edge when a north-west drag collapses it', () => {
    const collapsed = resizeBy(base, 'nw', 10_000, 10_000)
    expect(collapsed.width).toBe(MIN_EXTENT_UNITS)
    expect(collapsed.x + collapsed.width).toBeLessThanOrEqual(base.x + base.width)
  })
})

describe('rotateBy', () => {
  it('changes rotation and nothing else', () => {
    expect(rotateBy(base, 45)).toEqual({ ...base, rotation: 45 })
  })

  it('leaves stored position untouched — a rotated element is still authored where it was', () => {
    const spun = rotateBy(base, 90)
    expect(spun.x).toBe(base.x)
    expect(spun.y).toBe(base.y)
  })

  it('normalises to a single turn, so 370 and 10 are the same angle', () => {
    expect(rotateBy(base, 370).rotation).toBe(10)
    expect(rotateBy(base, -90).rotation).toBe(270)
  })
})
