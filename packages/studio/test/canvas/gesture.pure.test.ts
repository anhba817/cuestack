import { describe, expect, it } from 'vitest'
import { beginGesture, commitGesture, updateGesture } from '../../src/canvas/gesture.js'
import { SNAP_THRESHOLD_UNITS } from '../../src/geometry/constants.js'
import type { Geometry } from '../../src/geometry/types.js'

/**
 * T049 — dragging, tested as arithmetic.
 *
 * `.pure.test.ts`, so this runs in the node project with no `document`. That is the whole
 * argument for splitting the gesture out of the pointer handlers: under happy-dom a bounding
 * rect reports zero, so a drag whose logic lived in the listener could only be exercised
 * against a fake browser (research R-04).
 */
const canvas = { width: 1600, height: 900 }
const g = (x: number, y: number, w = 100, h = 100): Geometry => ({
  x,
  y,
  width: w,
  height: h,
  rotation: 0,
})

const gesture = (kind: 'move' | 'resize' | 'rotate', targets: Array<[string, Geometry]>, others: Geometry[] = [], scale = 1) =>
  beginGesture(kind, 'se', targets.map(([id, from]) => ({ id, from })), others, canvas, scale)

describe('move', () => {
  it('translates by the logical equivalent of the screen delta', () => {
    const state = gesture('move', [['a', g(100, 100)]], [], 0.5)
    const frame = updateGesture(state, 50, 25, 0)
    expect(frame.geometries.get('a')).toMatchObject({ x: 200, y: 150 })
  })

  it('applies deltas to the geometry captured at pointer-down, not cumulatively', () => {
    const state = gesture('move', [['a', g(0, 0)]])
    expect(updateGesture(state, 30, 0, 0).geometries.get('a')!.x).toBe(30)
    // A second frame at the same offset must land in the same place, not 60.
    expect(updateGesture(state, 30, 0, 0).geometries.get('a')!.x).toBe(30)
  })

  it('moves a multiple selection as a unit, preserving spacing (FR-003)', () => {
    const state = gesture('move', [
      ['a', g(0, 0)],
      ['b', g(300, 0)],
    ])
    const frame = updateGesture(state, 40, 10, 0)

    expect(frame.geometries.get('a')).toMatchObject({ x: 40, y: 10 })
    expect(frame.geometries.get('b')).toMatchObject({ x: 340, y: 10 })
    const gap = frame.geometries.get('b')!.x - frame.geometries.get('a')!.x
    expect(gap).toBe(300)
  })

  it('snaps, and carries the snap offset to every member so the set stays rigid', () => {
    // 'a' lands at 203; a sibling edge at 200 pulls it back 3, and 'b' must move 3 too.
    const state = gesture('move', [
      ['a', g(0, 0)],
      ['b', g(500, 0)],
    ], [g(200, 400)])
    const frame = updateGesture(state, 203, 0, SNAP_THRESHOLD_UNITS)

    expect(frame.geometries.get('a')!.x).toBe(200)
    expect(frame.geometries.get('b')!.x).toBe(700)
    expect(frame.guides.length).toBeGreaterThan(0)
  })

  it('reports no guides when nothing is in range', () => {
    // Positioned away from every canvas line as well as the sibling's: at y = 0 the element
    // would sit exactly on the canvas top edge and snap to it, which is correct behaviour and
    // was this test's first, careless fixture.
    const state = gesture('move', [['a', g(0, 200)]], [g(1200, 700)])
    expect(updateGesture(state, 100, 0, SNAP_THRESHOLD_UNITS).guides).toEqual([])
  })

  it('snaps to the canvas itself, not only to siblings', () => {
    const state = gesture('move', [['a', g(0, 200)]], [])
    // Dragging the left edge to 795 puts it 5 from the canvas centre line at 800.
    expect(updateGesture(state, 795, 0, SNAP_THRESHOLD_UNITS).geometries.get('a')!.x).toBe(800)
  })

  it('does nothing at an unusable scale rather than writing Infinity', () => {
    const state = gesture('move', [['a', g(10, 10)]], [], 0)
    expect(updateGesture(state, 100, 100, 0).geometries.get('a')).toMatchObject({ x: 10, y: 10 })
  })
})

describe('resize and rotate', () => {
  it('resizes from the grabbed handle', () => {
    const state = gesture('resize', [['a', g(0, 0, 100, 100)]])
    expect(updateGesture(state, 50, 20, 0).geometries.get('a')).toMatchObject({
      width: 150,
      height: 120,
    })
  })

  it('acts on one element even when several are selected (FR-003)', () => {
    const state = gesture('resize', [
      ['a', g(0, 0)],
      ['b', g(300, 0)],
    ])
    const frame = updateGesture(state, 50, 0, 0)
    expect(frame.geometries.has('a')).toBe(true)
    expect(frame.geometries.has('b')).toBe(false)
  })

  it('rotates without moving the element', () => {
    const state = gesture('rotate', [['a', g(100, 200)]])
    const frame = updateGesture(state, 90, 0, 0)
    expect(frame.geometries.get('a')).toMatchObject({ x: 100, y: 200, rotation: 90 })
  })
})

describe('commitGesture', () => {
  it('produces one edit for the whole gesture, not one per frame', () => {
    const state = gesture('move', [['a', g(0, 0)]])
    const edit = commitGesture(state, updateGesture(state, 40, 40, 0))
    expect(edit).toMatchObject({ kind: 'transform-elements', ids: ['a'] })
  })

  it('carries a per-element destination for a multiple move', () => {
    const state = gesture('move', [
      ['a', g(0, 0)],
      ['b', g(300, 0)],
    ])
    const edit = commitGesture(state, updateGesture(state, 40, 0, 0))

    expect(edit).toMatchObject({
      kind: 'transform-elements',
      ids: ['a', 'b'],
      perId: { a: { x: 40 }, b: { x: 340 } },
    })
  })

  it('sends width and height for a resize, and rotation alone for a rotate', () => {
    const resize = gesture('resize', [['a', g(0, 0)]])
    expect(commitGesture(resize, updateGesture(resize, 50, 50, 0))).toMatchObject({
      geometry: { width: 150, height: 150 },
    })

    const rotate = gesture('rotate', [['a', g(0, 0)]])
    expect(commitGesture(rotate, updateGesture(rotate, 45, 0, 0))).toEqual({
      kind: 'transform-elements',
      ids: ['a'],
      geometry: { rotation: 45 },
    })
  })

  it('returns nothing when there was no target, so an empty drag commits nothing', () => {
    const state = gesture('move', [])
    expect(commitGesture(state, updateGesture(state, 10, 10, 0))).toBeNull()
  })
})
