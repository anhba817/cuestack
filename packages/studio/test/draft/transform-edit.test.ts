import { describe, expect, it } from 'vitest'
import { applyEdit } from '../../src/draft/reducer.js'
import { MIN_EXTENT_UNITS } from '../../src/geometry/constants.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/** T030 — FR-003, FR-007, FR-008, and the mixed-selection edge case. */
describe('transform-elements', () => {
  const ctx = () => ({ mode: 'edit' as const, nextId: countingIds() })

  it('writes authored geometry', () => {
    const draft = lessonWith([element({ x: 0, y: 0 })])
    const id = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(draft, { kind: 'transform-elements', ids: [id], geometry: { x: 250, y: 125 } }, ctx())

    if (!result.ok) throw new Error('expected success')
    expect(result.draft.slides[0]!.elements[0]).toMatchObject({ x: 250, y: 125 })
  })

  it('never touches timing — geometry operations leave startMs and endMs alone', () => {
    const draft = lessonWith([element({ startMs: 1000, endMs: 5000 })])
    const id = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(draft, { kind: 'transform-elements', ids: [id], geometry: { x: 9 } }, ctx())

    if (!result.ok) throw new Error('expected success')
    expect(result.draft.slides[0]!.elements[0]).toMatchObject({ startMs: 1000, endMs: 5000 })
  })

  it('clamps extents positive rather than producing a manifest the schema rejects', () => {
    const draft = lessonWith([element()])
    const id = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(
      draft,
      { kind: 'transform-elements', ids: [id], geometry: { width: -50, height: 0 } },
      ctx(),
    )

    if (!result.ok) throw new Error('expected success')
    expect(result.draft.slides[0]!.elements[0]!.width).toBe(MIN_EXTENT_UNITS)
    expect(result.draft.slides[0]!.elements[0]!.height).toBe(MIN_EXTENT_UNITS)
  })

  it('refuses a lone locked element (BR-011)', () => {
    const draft = lessonWith([element({ locked: true })])
    const id = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(draft, { kind: 'transform-elements', ids: [id], geometry: { x: 5 } }, ctx())

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('locked')
      expect(result.elementId).toBe(id)
    }
  })

  /**
   * The edge case the specification calls out by name: one locked element in a selection of
   * five must not veto the drag. Applying to the unlocked members and reporting the rest is
   * the behaviour; refusing the whole set would be the easy mistake.
   */
  it('moves the unlocked members of a mixed selection and leaves the locked one', () => {
    const draft = lessonWith([element({ x: 0 }), element({ x: 0, locked: true }), element({ x: 0 })])
    const ids = draft.slides[0]!.elements.map((e) => e.id)
    const result = applyEdit(draft, { kind: 'transform-elements', ids, geometry: { x: 400 } }, ctx())

    if (!result.ok) throw new Error('expected the unlocked members to move')
    const xs = result.draft.slides[0]!.elements.map((e) => e.x)
    expect(xs).toEqual([400, 0, 400])
  })

  it('reports a missing element rather than silently doing nothing', () => {
    const draft = lessonWith([element()])
    const result = applyEdit(draft, { kind: 'transform-elements', ids: ['ghost'], geometry: { x: 1 } }, ctx())

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not-found')
  })

  it('permits geometry outside the canvas — an element may start off-stage', () => {
    const draft = lessonWith([element()])
    const id = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(
      draft,
      { kind: 'transform-elements', ids: [id], geometry: { x: -600, y: -400 } },
      ctx(),
    )

    if (!result.ok) throw new Error('expected success')
    expect(result.draft.slides[0]!.elements[0]).toMatchObject({ x: -600, y: -400 })
  })
})
