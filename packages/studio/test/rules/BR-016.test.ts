import { describe, expect, it } from 'vitest'
import { validate } from '@cuestack/schema/validate'
import { applyEdit } from '../../src/draft/reducer.js'
import { eventsOf, keyOf } from '../../src/sequence/events.js'
import { classify } from '../../src/sequence/relationships.js'
import type { SequenceAssignment } from '../../src/draft/edit.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * **BR-016** — Simple Sequence Mode and Timeline Mode read and write the same timeline data.
 * Mode-specific storage must not be introduced.
 *
 * Named for the rule, because Constitution II requires every business rule to have one and
 * because a rule tested only incidentally is a rule nobody will notice losing.
 *
 * The assertion is a manifest comparison rather than a claim about the code: apply a
 * sequence, serialize, read back, and confirm the only differences are timing values. If
 * anything else appears, the mode grew storage — and it would have grown it silently, since
 * every other test in this feature would still pass.
 *
 * This is also why the rule was worth stating: a stored relationship would have meant a
 * `schemaVersion` bump and a migration, and it would have put the *editor's mode* into a
 * learner's manifest.
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

/** Everything except the three fields a sequence is permitted to write. */
const withoutTiming = (manifest: unknown): string =>
  JSON.stringify(manifest, (key, value) =>
    key === 'startMs' || key === 'endMs' || key === 'durationMs' ? undefined : value,
  )

describe('BR-016: both modes read and write the same timeline data', () => {
  const authored = () =>
    lessonWith([
      element({ startMs: 4000, endMs: 5000, payload: { text: 'first' } }),
      element({ startMs: 100, endMs: 900, payload: { text: 'second' } }),
      element({
        startMs: 7000,
        endMs: 8000,
        payload: { text: 'third' },
        effects: [{ id: 'fx-1', type: 'fade', phase: 'enter', startMs: 7000, durationMs: 400, order: 0 }],
      }),
    ])

  it('changes nothing but timing when a sequence is applied', () => {
    const draft = authored()
    const before = JSON.parse(JSON.stringify(draft)) as unknown

    const result = applyEdit(
      draft,
      {
        kind: 'apply-sequence',
        relationships: assign(draft, [
          { kind: 'first' },
          { kind: 'after-previous' },
          { kind: 'after-previous-delay', delayMs: 250 },
          { kind: 'with-previous' },
        ]),
      },
      ctx(),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(withoutTiming(result.draft)).toBe(withoutTiming(before))
  })

  it('introduces no field of its own, under any name', () => {
    const draft = authored()
    const result = applyEdit(
      draft,
      { kind: 'apply-sequence', relationships: assign(draft, [{ kind: 'first' }, { kind: 'after-previous' }]) },
      ctx(),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const keys = new Set<string>()
    JSON.stringify(result.draft, (key, value) => {
      if (key) keys.add(key)
      return value
    })
    // Not `mode`: `slide.advance.mode` is a legitimate field of the format, and forbidding
    // the word rather than the concept is how a guard starts reporting the wrong thing.
    for (const forbidden of ['relationship', 'sequence', 'withPrevious', 'afterPrevious', 'delayMs']) {
      expect(keys.has(forbidden), forbidden).toBe(false)
    }
  })

  it('survives a round trip through the format itself', () => {
    // Serialize and re-validate: whatever the sequence wrote is ordinary lesson data, which
    // is the operative half of "the same timeline data".
    const draft = authored()
    const result = applyEdit(
      draft,
      { kind: 'apply-sequence', relationships: assign(draft, [{ kind: 'first' }, { kind: 'after-previous' }]) },
      ctx(),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const reloaded = JSON.parse(JSON.stringify(result.draft)) as typeof result.draft
    expect(validate(reloaded).ok).toBe(true)
    // And the sequence view reads back exactly what it wrote — the timeline's data is its data.
    expect(classify(eventsOf(reloaded.slides[0]!))).toEqual(classify(eventsOf(result.draft.slides[0]!)))
  })

  it('lets the timeline change a value the sequence then reports (the other direction)', () => {
    const draft = authored()
    const id = draft.slides[0]!.elements[0]!.id
    const retimed = applyEdit(draft, { kind: 'set-timing', id, startMs: 0, endMs: 1000 }, ctx())
    expect(retimed.ok).toBe(true)
    if (!retimed.ok) return

    // No conversion, no import step: the sequence view simply classifies what is there.
    const relationships = classify(eventsOf(retimed.draft.slides[0]!))
    expect(relationships[0]).toEqual({ kind: 'first' })
  })
})
