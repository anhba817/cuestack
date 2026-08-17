import { describe, expect, it } from 'vitest'
import { validate } from '@cuestack/schema/validate'
import { applyEdit } from '../../src/draft/reducer.js'
import { countingIds } from '../harness/ids.js'
import { element, locked, lessonWith } from '../harness/corpus.js'

/**
 * `set-timing`, and the five promises every edit in this reducer makes.
 *
 * Pure, no mutation, a validated result, refused in read-only, refused when locked. Feature
 * 005 established them and this variant inherits them rather than restating them — which is
 * the point of one mutation path (FR-042).
 *
 * A single `id`, not an array. Multi-select timing edits are out of scope — "dragging
 * re-times one element at a time" — and a plural signature would be the editor quietly
 * growing an affordance no requirement asks for.
 */

const ctx = () => ({ mode: 'edit' as const, nextId: countingIds() })

describe('set-timing', () => {
  it('moves both edges when both are given', () => {
    const el = element({ startMs: 0, endMs: 2000 })
    const draft = lessonWith([el])
    const result = applyEdit(draft, { kind: 'set-timing', id: el.id, startMs: 1000, endMs: 4000 }, ctx())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const after = result.draft.slides[0]!.elements[0]!
    expect(after.startMs).toBe(1000)
    expect(after.endMs).toBe(4000)
  })

  it('moves one edge and leaves the other exactly as it was', () => {
    const el = element({ startMs: 500, endMs: 2500 })
    const result = applyEdit(lessonWith([el]), { kind: 'set-timing', id: el.id, endMs: 6000 }, ctx())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.slides[0]!.elements[0]!.startMs).toBe(500)
    expect(result.draft.slides[0]!.elements[0]!.endMs).toBe(6000)
  })

  it('does not mutate the draft it was given', () => {
    const el = element({ startMs: 0, endMs: 2000 })
    const draft = lessonWith([el])
    const before = JSON.stringify(draft)
    applyEdit(draft, { kind: 'set-timing', id: el.id, startMs: 3000 }, ctx())
    expect(JSON.stringify(draft)).toBe(before)
  })

  it('leaves the draft valid', () => {
    const el = element({ startMs: 0, endMs: 2000 })
    const result = applyEdit(lessonWith([el]), { kind: 'set-timing', id: el.id, startMs: 100, endMs: 900 }, ctx())
    expect(result.ok).toBe(true)
    if (result.ok) expect(validate(result.draft).ok).toBe(true)
  })

  it('refuses timing the schema would reject, rather than writing it', () => {
    // `endMs > startMs` is a cross-field refinement, so this is the reducer's own guard
    // failing over into the validation it runs after every edit (FR-041).
    const el = element({ startMs: 0, endMs: 2000 })
    const result = applyEdit(lessonWith([el]), { kind: 'set-timing', id: el.id, startMs: 5000, endMs: 1000 }, ctx())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
  })

  it('refuses a locked element and says why (FR-016, BR-011)', () => {
    const el = locked()
    const result = applyEdit(lessonWith([el]), { kind: 'set-timing', id: el.id, startMs: 1000 }, ctx())

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('locked')
    expect(result.message).toMatch(/locked/i)
    expect(result.elementId).toBe(el.id)
  })

  it('refuses an element that is not there', () => {
    const result = applyEdit(lessonWith([element()]), { kind: 'set-timing', id: 'nope', startMs: 0 }, ctx())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not-found')
  })

  it('refuses in read-only, before it looks at anything else', () => {
    const el = element()
    const result = applyEdit(
      lessonWith([el]),
      { kind: 'set-timing', id: el.id, startMs: 1000 },
      { mode: 'read-only', nextId: countingIds() },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('read-only')
  })
})
