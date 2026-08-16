import { describe, expect, it } from 'vitest'
import { applyEdit } from '../../src/draft/reducer.js'
import { builtinElementEditors } from '../../src/registry/editors.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/** T031 — FR-015: text goes through the type's registration, never a branch on type. */
describe('set-text', () => {
  const ctx = () => ({ mode: 'edit' as const, nextId: countingIds() })

  it('writes a text element’s text', () => {
    const draft = lessonWith([element({ payload: { text: 'before' } })])
    const id = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(draft, { kind: 'set-text', id, text: 'after' }, ctx())

    if (!result.ok) throw new Error('expected success')
    expect(result.draft.slides[0]!.elements[0]!.payload).toEqual({ text: 'after' })
  })

  /**
   * The proof that nothing branches on element type: a button's text lives at
   * `payload.label`, not `payload.text`, and the reducer has no idea. It asks the registry.
   */
  it('writes a button’s label through the same edit, with no type-specific code', () => {
    const draft = lessonWith([
      element({ type: 'button', payload: { label: 'Old', action: 'next_slide' } }),
    ])
    const id = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(draft, { kind: 'set-text', id, text: 'New' }, ctx())

    if (!result.ok) throw new Error('expected success')
    expect(result.draft.slides[0]!.elements[0]!.payload).toEqual({
      label: 'New',
      action: 'next_slide',
    })
  })

  it('refuses a type with no on-canvas text surface', () => {
    const draft = lessonWith([element({ type: 'shape', payload: { shape: 'rect' } })])
    const id = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(draft, { kind: 'set-text', id, text: 'nope' }, ctx())

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('unsupported')
  })

  it('refuses a locked element (FR-008 — locked means not text-editable either)', () => {
    const draft = lessonWith([element({ locked: true })])
    const id = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(draft, { kind: 'set-text', id, text: 'nope' }, ctx())

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('locked')
  })

  it('preserves other payload members', () => {
    const draft = lessonWith([
      element({ type: 'button', payload: { label: 'A', action: 'replay_slide' } }),
    ])
    const id = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(draft, { kind: 'set-text', id, text: 'B' }, ctx())

    if (!result.ok) throw new Error('expected success')
    expect(result.draft.slides[0]!.elements[0]!.payload).toMatchObject({ action: 'replay_slide' })
  })
})

describe('textSurface round-trip', () => {
  const withSurface = builtinElementEditors.filter((e) => e.textSurface)

  it('covers the types that declare one, and it is not an empty set', () => {
    expect(withSurface.map((e) => e.type).sort()).toEqual(['button', 'text'])
  })

  it.each(withSurface)('write(payload, read(payload)) is the identity for $type', (editor) => {
    const payload = editor.defaults.payload
    const surface = editor.textSurface!
    expect(surface.write(payload, surface.read(payload))).toEqual(payload)
  })

  it.each(withSurface)('reads back what it wrote for $type', (editor) => {
    const surface = editor.textSurface!
    const written = surface.write(editor.defaults.payload, 'round trip')
    expect(surface.read(written)).toBe('round trip')
  })
})
