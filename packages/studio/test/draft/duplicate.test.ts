import { describe, expect, it } from 'vitest'
import { validate } from '@cuestack/schema/validate'
import { applyEdit } from '../../src/draft/reducer.js'
import { DUPLICATE_OFFSET_UNITS } from '../../src/geometry/constants.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/** T079 — FR-032: a copy is a new element, not a second reference to the old one. */
describe('duplicate', () => {
  const ctx = () => ({ mode: 'edit' as const, nextId: countingIds() })

  it('adds an element with a distinct identity', () => {
    const draft = lessonWith([element()])
    const source = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(draft, { kind: 'duplicate', ids: [source] }, ctx())

    if (!result.ok) throw new Error('expected success')
    const elements = result.draft.slides[0]!.elements
    expect(elements).toHaveLength(2)
    expect(elements[1]!.id).not.toBe(source)
    expect(new Set(elements.map((e) => e.id)).size).toBe(2)
  })

  it('offsets the copy so it is visibly a second element', () => {
    const draft = lessonWith([element({ x: 100, y: 100 })])
    const result = applyEdit(draft, { kind: 'duplicate', ids: [draft.slides[0]!.elements[0]!.id] }, ctx())

    if (!result.ok) throw new Error('expected success')
    expect(result.draft.slides[0]!.elements[1]).toMatchObject({
      x: 100 + DUPLICATE_OFFSET_UNITS,
      y: 100 + DUPLICATE_OFFSET_UNITS,
    })
  })

  it('carries every other property across', () => {
    const draft = lessonWith([
      element({ rotation: 30, startMs: 500, endMs: 4000, locked: true, payload: { text: 'copy me' } }),
    ])
    const result = applyEdit(draft, { kind: 'duplicate', ids: [draft.slides[0]!.elements[0]!.id] }, ctx())

    if (!result.ok) throw new Error('expected success')
    expect(result.draft.slides[0]!.elements[1]).toMatchObject({
      rotation: 30,
      startMs: 500,
      endMs: 4000,
      locked: true,
      payload: { text: 'copy me' },
    })
  })

  it('consumes exactly one id per element created', () => {
    const draft = lessonWith([element(), element()])
    const ids = draft.slides[0]!.elements.map((e) => e.id)
    const result = applyEdit(draft, { kind: 'duplicate', ids }, ctx())

    if (!result.ok) throw new Error('expected success')
    expect(result.idsCreated).toHaveLength(2)
    expect(result.draft.slides[0]!.elements).toHaveLength(4)
  })

  it('places the copy above everything, so it is not hidden behind its source', () => {
    const draft = lessonWith([element({ zIndex: 0 }), element({ zIndex: 9 })])
    const result = applyEdit(draft, { kind: 'duplicate', ids: [draft.slides[0]!.elements[0]!.id] }, ctx())

    if (!result.ok) throw new Error('expected success')
    expect(result.draft.slides[0]!.elements.at(-1)!.zIndex).toBe(10)
  })

  it('leaves the result valid', () => {
    const draft = lessonWith([element()])
    const result = applyEdit(draft, { kind: 'duplicate', ids: [draft.slides[0]!.elements[0]!.id] }, ctx())
    if (!result.ok) throw new Error('expected success')
    expect(validate(result.draft).ok).toBe(true)
  })

  it('duplicates a locked element — locking guards transforms, not copying', () => {
    const draft = lessonWith([element({ locked: true })])
    const result = applyEdit(draft, { kind: 'duplicate', ids: [draft.slides[0]!.elements[0]!.id] }, ctx())
    expect(result.ok).toBe(true)
  })
})

describe('paste', () => {
  const ctx = () => ({ mode: 'edit' as const, nextId: countingIds() })

  it('adds the pasted elements with fresh identities', () => {
    const draft = lessonWith([element()])
    const source = element({ payload: { text: 'from the clipboard' } })
    const result = applyEdit(draft, { kind: 'paste', elements: [source] }, ctx())

    if (!result.ok) throw new Error('expected success')
    const added = result.draft.slides[0]!.elements[1]!
    expect(added.id).not.toBe(source.id)
    expect(added.payload).toEqual({ text: 'from the clipboard' })
  })

  it('does not collide when the clipboard holds an element still on the slide', () => {
    const draft = lessonWith([element()])
    const existing = draft.slides[0]!.elements[0]!
    const result = applyEdit(draft, { kind: 'paste', elements: [existing] }, ctx())

    if (!result.ok) throw new Error('expected success')
    const ids = result.draft.slides[0]!.elements.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(validate(result.draft).ok).toBe(true)
  })

  it('pastes nothing for an empty clipboard, and stays valid', () => {
    const draft = lessonWith([element()])
    const result = applyEdit(draft, { kind: 'paste', elements: [] }, ctx())

    if (!result.ok) throw new Error('expected success')
    expect(result.draft.slides[0]!.elements).toHaveLength(1)
    expect(result.idsCreated).toEqual([])
  })
})
