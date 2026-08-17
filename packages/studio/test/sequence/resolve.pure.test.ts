import { describe, expect, it } from 'vitest'
import { classify, resolveSequence } from '../../src/sequence/relationships.js'
import { eventsOf } from '../../src/sequence/events.js'
import { element, slide } from '../harness/corpus.js'
import { effect } from '../harness/timeline.js'

/**
 * A sequence resolves to absolute times, and to nothing else.
 *
 * FR-029: "A sequence MUST resolve to absolute timing values, and MUST NOT introduce any
 * storage of its own." Both views read and write the same timeline data, which is what makes
 * switching between them lossless rather than a conversion.
 */

const at = (startMs: number, endMs: number) => element({ startMs, endMs })

describe('resolveSequence', () => {
  it('starts the first event at the slide’s beginning (FR-033)', () => {
    const events = eventsOf(slide([at(4000, 6000)]))
    expect(resolveSequence(events, [{ kind: 'first' }])[0]!.startMs).toBe(0)
  })

  it('places With Previous at the same moment as its predecessor', () => {
    const events = eventsOf(slide([at(0, 2000), at(5000, 6000)]))
    const changes = resolveSequence(events, [{ kind: 'first' }, { kind: 'with-previous' }])
    expect(changes[1]!.startMs).toBe(changes[0]!.startMs)
  })

  it('places After Previous at its predecessor’s end', () => {
    const events = eventsOf(slide([at(0, 2000), at(5000, 6000)]))
    const changes = resolveSequence(events, [{ kind: 'first' }, { kind: 'after-previous' }])
    expect(changes[1]!.startMs).toBe(2000)
  })

  it('adds a delay to that end, exactly', () => {
    const events = eventsOf(slide([at(0, 2000), at(5000, 6000)]))
    const changes = resolveSequence(events, [
      { kind: 'first' },
      { kind: 'after-previous-delay', delayMs: 750 },
    ])
    expect(changes[1]!.startMs).toBe(2750)
  })

  it('preserves an element’s duration when its start moves', () => {
    const events = eventsOf(slide([at(0, 1000), at(5000, 8000)]))
    const changes = resolveSequence(events, [{ kind: 'first' }, { kind: 'after-previous' }])
    // The second element ran for 3000 ms and still does. A sequence says *when*, never how long.
    expect(changes[1]!.endMs! - changes[1]!.startMs).toBe(3000)
  })

  it('preserves an effect’s duration by writing only its start', () => {
    const el = element({ startMs: 0, endMs: 8000, effects: [effect({ startMs: 4000, durationMs: 600 })] })
    const events = eventsOf(slide([el]))
    const changes = resolveSequence(events, classify(events))
    const forEffect = changes.find((c) => c.eventKey.includes(':'))!
    // No `endMs`: the format stores a duration for an effect, so writing an end would be
    // writing a field that does not exist.
    expect(forEffect.endMs).toBeUndefined()
  })

  it('leaves a Custom event where the teacher put it', () => {
    // This function is not the place that discards authored timing. FR-032 requires a
    // confirmation before that happens, and it happens in the view.
    const events = eventsOf(slide([at(0, 1000), at(500, 2000)]))
    const changes = resolveSequence(events, [{ kind: 'first' }, { kind: 'custom' }])
    expect(changes[1]!.startMs).toBe(500)
  })

  it('produces non-negative whole milliseconds throughout (BR-001, BR-002)', () => {
    const events = eventsOf(slide([at(0, 1000), at(2000, 3000), at(4000, 5000)]))
    const changes = resolveSequence(events, [
      { kind: 'first' },
      { kind: 'after-previous-delay', delayMs: 333 },
      { kind: 'with-previous' },
    ])
    for (const change of changes) {
      expect(Number.isInteger(change.startMs)).toBe(true)
      expect(change.startMs).toBeGreaterThanOrEqual(0)
      if (change.endMs !== undefined) expect(Number.isInteger(change.endMs)).toBe(true)
    }
  })

  it('handles an empty slide without inventing anything', () => {
    expect(resolveSequence([], [])).toEqual([])
  })

  it('chains: each event is placed against where the previous one *landed*', () => {
    // Not against where it started. Three After Previous relationships over 1000 ms events
    // must lay them end to end from zero, whatever they were authored at.
    const events = eventsOf(slide([at(7000, 8000), at(200, 1200), at(4000, 5000)]))
    const changes = resolveSequence(events, [
      { kind: 'first' },
      { kind: 'after-previous' },
      { kind: 'after-previous' },
    ])
    expect(changes.map((c) => c.startMs)).toEqual([0, 1000, 2000])
  })
})
