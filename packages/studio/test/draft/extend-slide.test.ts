import { describe, expect, it } from 'vitest'
import { validate } from '@cuestack/schema/validate'
import { applyEdit } from '../../src/draft/reducer.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * "Extend the slide to fit", with the number computed rather than supplied.
 *
 * FR-038 is an offer with a *computed* target. A surface able to pass its own would let the
 * action produce a slide that still overruns — which is the one outcome the offer exists to
 * prevent.
 */

const ctx = () => ({ mode: 'edit' as const, nextId: countingIds() })

describe('extend-slide', () => {
  it('grows the slide to the latest end, exactly (SC-011)', () => {
    const draft = lessonWith([element({ startMs: 0, endMs: 12_000 })], { durationMs: 8000 })
    const result = applyEdit(draft, { kind: 'extend-slide' }, ctx())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.slides[0]!.durationMs).toBe(12_000)
    expect(validate(result.draft).ok).toBe(true)
  })

  it('counts an effect’s end, not just an element’s', () => {
    const draft = lessonWith(
      [
        element({
          startMs: 0,
          endMs: 4000,
          effects: [{ id: 'fx-1', type: 'fade', phase: 'exit', startMs: 9000, durationMs: 500, order: 0 }],
        }),
      ],
      { durationMs: 8000 },
    )
    const result = applyEdit(draft, { kind: 'extend-slide' }, ctx())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.draft.slides[0]!.durationMs).toBe(9500)
  })

  it('takes the latest across everything, not the first it finds', () => {
    const draft = lessonWith(
      [element({ startMs: 0, endMs: 20_000 }), element({ startMs: 0, endMs: 9000 })],
      { durationMs: 8000 },
    )
    const result = applyEdit(draft, { kind: 'extend-slide' }, ctx())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.draft.slides[0]!.durationMs).toBe(20_000)
  })

  it('refuses when there is nothing to fix, rather than silently doing nothing', () => {
    const draft = lessonWith([element({ startMs: 0, endMs: 4000 })], { durationMs: 8000 })
    const result = applyEdit(draft, { kind: 'extend-slide' }, ctx())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/already fits/i)
  })

  it('does not mutate the draft it was given', () => {
    const draft = lessonWith([element({ startMs: 0, endMs: 12_000 })], { durationMs: 8000 })
    const snapshot = JSON.stringify(draft)
    applyEdit(draft, { kind: 'extend-slide' }, ctx())
    expect(JSON.stringify(draft)).toBe(snapshot)
  })

  it('leaves every element’s own timing alone — it grows the slide, not the content', () => {
    const el = element({ startMs: 3000, endMs: 12_000 })
    const draft = lessonWith([el], { durationMs: 8000 })
    const result = applyEdit(draft, { kind: 'extend-slide' }, ctx())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.slides[0]!.elements[0]!.startMs).toBe(3000)
    expect(result.draft.slides[0]!.elements[0]!.endMs).toBe(12_000)
  })

  it('refuses in read-only', () => {
    const draft = lessonWith([element({ startMs: 0, endMs: 12_000 })], { durationMs: 8000 })
    const result = applyEdit(draft, { kind: 'extend-slide' }, { mode: 'read-only', nextId: countingIds() })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('read-only')
  })
})
