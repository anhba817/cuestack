import { describe, expect, it } from 'vitest'
import { validate, ELEMENT_TYPES } from '@cuestack/schema/validate'
import { applyEdit } from '../../src/draft/reducer.js'
import { countingIds } from '../harness/ids.js'
import { element, emptySlide, lessonWith } from '../harness/corpus.js'

/** T029 — FR-013, FR-014, SC-011. Every MVP type is addable and immediately valid. */
describe('add-element', () => {
  const ctx = () => ({ mode: 'edit' as const, nextId: countingIds() })

  it.each(ELEMENT_TYPES)('adds a valid %s', (type) => {
    const result = applyEdit(emptySlide(), { kind: 'add-element', type }, ctx())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(validate(result.draft).ok).toBe(true)
    expect(result.draft.slides[0]!.elements).toHaveLength(1)
    expect(result.draft.slides[0]!.elements[0]!.type).toBe(type)
  })

  it('consumes exactly one id per element created', () => {
    const result = applyEdit(emptySlide(), { kind: 'add-element', type: 'text' }, ctx())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.idsCreated).toEqual(['el-1'])
  })

  it('gives the new element a positive size', () => {
    const result = applyEdit(emptySlide(), { kind: 'add-element', type: 'shape' }, ctx())
    if (!result.ok) throw new Error('expected success')
    const added = result.draft.slides[0]!.elements[0]!
    expect(added.width).toBeGreaterThan(0)
    expect(added.height).toBeGreaterThan(0)
  })

  it('places it above everything already on the slide', () => {
    const draft = lessonWith([element({ zIndex: 7 }), element({ zIndex: 3 })])
    const result = applyEdit(draft, { kind: 'add-element', type: 'text' }, ctx())
    if (!result.ok) throw new Error('expected success')
    const added = result.draft.slides[0]!.elements.at(-1)!
    expect(added.zIndex).toBe(8)
  })

  /**
   * FR-014's clause that matters most. An element added while the teacher has scrubbed
   * part-way through the slide must be visible immediately, or insertion looks like it
   * failed — so a new element spans the slide rather than starting at the current moment.
   */
  it('spans the slide, so it is visible at any authoring time', () => {
    const draft = lessonWith([])
    const result = applyEdit(draft, { kind: 'add-element', type: 'text' }, ctx())
    if (!result.ok) throw new Error('expected success')
    const added = result.draft.slides[0]!.elements[0]!
    expect(added.startMs).toBe(0)
    expect(added.endMs).toBe(draft.slides[0]!.durationMs)
  })

  it('refuses a type with no editor registration rather than writing a broken element', () => {
    const result = applyEdit(emptySlide(), { kind: 'add-element', type: 'hologram' }, ctx())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('unsupported')
  })

  it('leaves the source draft untouched', () => {
    const draft = emptySlide()
    const before = JSON.stringify(draft)
    applyEdit(draft, { kind: 'add-element', type: 'text' }, ctx())
    expect(JSON.stringify(draft)).toBe(before)
  })
})
