import { describe, expect, it } from 'vitest'
import { classify, resolveSequence } from '../../src/sequence/relationships.js'
import { eventsOf, type SequenceEvent } from '../../src/sequence/events.js'
import type { SequenceRelationship } from '../../src/draft/edit.js'
import { element, slide } from '../harness/corpus.js'

/**
 * The whole mode's correctness in one line.
 *
 * `classify(resolveSequence(events, relationships))` returns the relationships it was given.
 * If that holds, a teacher's stated intent survives being turned into numbers and read back —
 * which is exactly what FR-030 promises when they switch to the timeline and back.
 *
 * It is also the test to write first, and the one that would catch the subtle failures: an
 * off-by-one in a delay, a chain placed against the authored time rather than the resolved
 * one, a classifier and a resolver that disagree about what "after" means.
 */

const at = (startMs: number, endMs: number) => element({ startMs, endMs })

/** Apply the changes to the events, as the reducer would, so they can be re-classified. */
function reapply(events: readonly SequenceEvent[], relationships: readonly SequenceRelationship[]): SequenceEvent[] {
  const changes = resolveSequence(events, relationships)
  return events.map((event, index) => {
    const change = changes[index]!
    const duration = event.endMs - event.startMs
    return { ...event, startMs: change.startMs, endMs: change.startMs + duration }
  })
}

describe('the round trip', () => {
  const cases: { name: string; relationships: SequenceRelationship[] }[] = [
    { name: 'three end to end', relationships: [{ kind: 'first' }, { kind: 'after-previous' }, { kind: 'after-previous' }] },
    { name: 'all together', relationships: [{ kind: 'first' }, { kind: 'with-previous' }, { kind: 'with-previous' }] },
    {
      name: 'delays',
      relationships: [
        { kind: 'first' },
        { kind: 'after-previous-delay', delayMs: 500 },
        { kind: 'after-previous-delay', delayMs: 1 },
      ],
    },
    {
      name: 'mixed',
      relationships: [{ kind: 'first' }, { kind: 'with-previous' }, { kind: 'after-previous-delay', delayMs: 2000 }],
    },
  ]

  it.each(cases)('survives $name', ({ relationships }) => {
    const events = eventsOf(slide([at(0, 1000), at(3000, 4500), at(6000, 6800)]))
    expect(classify(reapply(events, relationships))).toEqual(relationships)
  })

  it('is idempotent — resolving twice changes nothing the second time', () => {
    const events = eventsOf(slide([at(0, 1000), at(3000, 4500), at(6000, 6800)]))
    const relationships: SequenceRelationship[] = [
      { kind: 'first' },
      { kind: 'after-previous' },
      { kind: 'after-previous-delay', delayMs: 250 },
    ]
    const once = reapply(events, relationships)
    const twice = reapply(once, relationships)
    expect(twice).toEqual(once)
  })

  it('leaves durations untouched across the trip', () => {
    const events = eventsOf(slide([at(0, 1000), at(3000, 4500)]))
    const after = reapply(events, [{ kind: 'first' }, { kind: 'after-previous' }])
    expect(after.map((e) => e.endMs - e.startMs)).toEqual(events.map((e) => e.endMs - e.startMs))
  })
})
