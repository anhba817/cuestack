import { describe, expect, it } from 'vitest'
import { validate } from '@cuestack/schema/validate'
import { applyEdit } from '../../src/draft/reducer.js'
import { eventsOf, keyOf } from '../../src/sequence/events.js'
import { classify } from '../../src/sequence/relationships.js'
import type { SequenceAssignment } from '../../src/draft/edit.js'
import { countingIds } from '../harness/ids.js'
import { element, locked, lessonWith } from '../harness/corpus.js'

/**
 * Applying a sequence, through the same mutation path as every other edit (FR-042).
 *
 * The reducer *resolves* rather than accepting resolved times: the edit carries intent and
 * the absolute values are computed here, so a surface cannot supply a different answer than
 * the relationships imply.
 */

const ctx = () => ({ mode: 'edit' as const, nextId: countingIds() })

const assign = (
  draft: ReturnType<typeof lessonWith>,
  kinds: SequenceAssignment['relationship'][],
): SequenceAssignment[] =>
  eventsOf(draft.slides[0]!).map((event, index) => ({
    eventKey: keyOf(event),
    relationship: kinds[index] ?? { kind: 'custom' },
  }))

describe('apply-sequence', () => {
  it('lays three elements end to end from the slide’s beginning', () => {
    const draft = lessonWith([
      element({ startMs: 5000, endMs: 6000 }),
      element({ startMs: 200, endMs: 1200 }),
      element({ startMs: 3000, endMs: 4000 }),
    ])
    const result = applyEdit(
      draft,
      {
        kind: 'apply-sequence',
        relationships: assign(draft, [{ kind: 'first' }, { kind: 'after-previous' }, { kind: 'after-previous' }]),
      },
      ctx(),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const starts = result.draft.slides[0]!.elements.map((e) => e.startMs).sort((a, b) => a - b)
    expect(starts).toEqual([0, 1000, 2000])
    expect(validate(result.draft).ok).toBe(true)
  })

  it('changes nothing but timing — the mode stores nothing of its own (FR-029)', () => {
    const draft = lessonWith([element({ startMs: 3000, endMs: 4000 }), element({ startMs: 9000, endMs: 9500 })])
    const before = JSON.parse(JSON.stringify(draft)) as typeof draft

    const result = applyEdit(
      draft,
      { kind: 'apply-sequence', relationships: assign(draft, [{ kind: 'first' }, { kind: 'after-previous' }]) },
      ctx(),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Strip the three fields a sequence may write; everything else must be byte-identical.
    const strip = (m: unknown) =>
      JSON.stringify(m, (key, value) => (key === 'startMs' || key === 'endMs' ? undefined : value))
    expect(strip(result.draft)).toBe(strip(before))
  })

  it('does not mutate the draft it was given', () => {
    const draft = lessonWith([element({ startMs: 1000, endMs: 2000 })])
    const snapshot = JSON.stringify(draft)
    applyEdit(draft, { kind: 'apply-sequence', relationships: assign(draft, [{ kind: 'first' }]) }, ctx())
    expect(JSON.stringify(draft)).toBe(snapshot)
  })

  it('applies to the unlocked events and leaves the locked ones alone', () => {
    /**
     * The reducer's own convention, not an exception to it. `partitionLocked`'s comment says
     * why: "returning a refusal for the whole set would let one locked element silently veto
     * a five-element drag." A sequence is the largest multiple-element edit there is.
     */
    const free = element({ startMs: 5000, endMs: 6000 })
    const pinned = locked()
    const draft = lessonWith([free, pinned])
    const before = draft.slides[0]!.elements.find((e) => e.id === pinned.id)!.startMs

    const result = applyEdit(
      draft,
      { kind: 'apply-sequence', relationships: assign(draft, [{ kind: 'first' }, { kind: 'after-previous' }]) },
      ctx(),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.slides[0]!.elements.find((e) => e.id === pinned.id)!.startMs).toBe(before)
  })

  it('refuses only when every affected element is locked', () => {
    const draft = lessonWith([locked(), locked()])
    const result = applyEdit(
      draft,
      { kind: 'apply-sequence', relationships: assign(draft, [{ kind: 'first' }, { kind: 'after-previous' }]) },
      ctx(),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('locked')
      expect(result.message).toMatch(/locked/i)
    }
  })

  it('refuses in read-only', () => {
    const draft = lessonWith([element()])
    const result = applyEdit(
      draft,
      { kind: 'apply-sequence', relationships: assign(draft, [{ kind: 'first' }]) },
      { mode: 'read-only', nextId: countingIds() },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('read-only')
  })

  it('refuses an element that is not on the slide', () => {
    const draft = lessonWith([element()])
    const result = applyEdit(
      draft,
      { kind: 'apply-sequence', relationships: [{ eventKey: 'ghost', relationship: { kind: 'first' } }] },
      ctx(),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not-found')
  })

  it('moves an effect by its start alone, keeping its duration', () => {
    const el = element({
      startMs: 0,
      endMs: 1000,
      effects: [{ id: 'fx-1', type: 'fade', phase: 'enter', startMs: 6000, durationMs: 400, order: 0 }],
    })
    const draft = lessonWith([el])
    const result = applyEdit(
      draft,
      { kind: 'apply-sequence', relationships: assign(draft, [{ kind: 'first' }, { kind: 'after-previous' }]) },
      ctx(),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const effect = (result.draft.slides[0]!.elements[0] as unknown as { effects: { startMs: number; durationMs: number }[] })
      .effects[0]!
    expect(effect.startMs).toBe(1000)
    expect(effect.durationMs).toBe(400)
  })

  it('resolves to what classify then reads back — the round trip, through the reducer', () => {
    const draft = lessonWith([
      element({ startMs: 4000, endMs: 5000 }),
      element({ startMs: 100, endMs: 900 }),
      element({ startMs: 7000, endMs: 8000 }),
    ])
    const wanted: SequenceAssignment['relationship'][] = [
      { kind: 'first' },
      { kind: 'after-previous-delay', delayMs: 500 },
      { kind: 'with-previous' },
    ]
    const result = applyEdit(draft, { kind: 'apply-sequence', relationships: assign(draft, wanted) }, ctx())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(classify(eventsOf(result.draft.slides[0]!))).toEqual(wanted)
  })
})
