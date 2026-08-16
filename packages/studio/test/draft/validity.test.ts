import { describe, expect, it } from 'vitest'
import { validate } from '@cuestack/schema/validate'
import { applyEdit } from '../../src/draft/reducer.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * T014 — FR-045: the editor cannot construct a lesson the player would refuse.
 *
 * The reducer runs the schema's own validator after every edit and refuses rather than
 * returning a draft that fails it. This is the requirement that makes the guarantee a
 * property of the system instead of a hope about each handler, and it is why the editor may
 * depend on Zod while the player may not (research R-03).
 */
describe('every accepted edit leaves the draft valid', () => {
  const ctx = () => ({ mode: 'edit' as const, nextId: countingIds() })

  it('the fixture itself is valid, or nothing below means anything', () => {
    expect(validate(lessonWith([element()])).ok).toBe(true)
  })

  it('validates the result of an accepted edit', () => {
    const draft = lessonWith([element()])
    const result = applyEdit(draft, { kind: 'add-element', type: 'text' }, ctx())

    expect(result.ok).toBe(true)
    if (result.ok) expect(validate(result.draft).ok).toBe(true)
  })

  it('refuses with `invalid` rather than returning a draft the player would reject', () => {
    const draft = lessonWith([element()])
    const id = draft.slides[0]!.elements[0]!.id

    // endMs <= startMs violates BR-003, which the schema enforces and the reducer must not
    // be able to write past.
    const result = applyEdit(draft, { kind: 'set-field', id, path: ['endMs'], value: 0 }, ctx())

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
    expect(validate(draft).ok).toBe(true)
  })

  it('names the affected element when it refuses, so the message can say what broke', () => {
    const draft = lessonWith([element()])
    const id = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(draft, { kind: 'set-field', id, path: ['width'], value: -1 }, ctx())

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.elementId).toBe(id)
      expect(result.message.length).toBeGreaterThan(0)
    }
  })
})
