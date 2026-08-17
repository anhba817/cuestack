import { describe, expect, it } from 'vitest'
import { classify } from '../../src/sequence/relationships.js'
import { eventsOf } from '../../src/sequence/events.js'
import { element, slide } from '../harness/corpus.js'

/**
 * A relationship is *derived*, never stored.
 *
 * Constitution III forbids mode-specific storage in as many words, so Simple Sequence reads
 * absolute times and classifies them. That removes the largest question ED-4 could have had:
 * a stored sequence would have meant a `schemaVersion` bump and a migration.
 *
 * **Exact equality, deliberately.** A tolerance would make two teachers' identical-looking
 * slides classify differently, and the format stores integer milliseconds so exactness is
 * achievable. That decision is what the "1 ms after" case below exists to hold.
 */

const at = (startMs: number, endMs: number) => element({ startMs, endMs })
const kinds = (...elements: ReturnType<typeof element>[]) =>
  classify(eventsOf(slide(elements))).map((r) => r.kind)

describe('the classification table', () => {
  it('calls the first event First — it has no predecessor (FR-033)', () => {
    expect(kinds(at(0, 1000))).toEqual(['first'])
  })

  it('calls equal starts With Previous', () => {
    expect(kinds(at(1000, 2000), at(1000, 3000))).toEqual(['first', 'with-previous'])
  })

  it('calls a start at the previous end After Previous', () => {
    expect(kinds(at(0, 2000), at(2000, 4000))).toEqual(['first', 'after-previous'])
  })

  it('calls a start after the previous end a delay, and reports it exactly', () => {
    const relationships = classify(eventsOf(slide([at(0, 2000), at(3500, 5000)])))
    expect(relationships[1]).toEqual({ kind: 'after-previous-delay', delayMs: 1500 })
  })

  it('treats one millisecond after as a delay of one, not as After Previous', () => {
    // The exactness decision, in the smallest case that can distinguish it. A tolerance of
    // even a few milliseconds would swallow this and make the mode's answer depend on a
    // number nobody chose deliberately.
    const relationships = classify(eventsOf(slide([at(0, 2000), at(2001, 3000)])))
    expect(relationships[1]).toEqual({ kind: 'after-previous-delay', delayMs: 1 })
  })

  it('calls an overlap Custom rather than reinterpreting it (FR-031)', () => {
    // Beginning while the predecessor is still running is neither "with" nor "after". Showing
    // it as Custom is the requirement; quietly calling it With Previous would rewrite the
    // teacher's meaning on a screen they opened to read it.
    expect(kinds(at(0, 4000), at(2000, 6000))).toEqual(['first', 'custom'])
  })

  it('calls a start *before* the previous one Custom too', () => {
    // Cannot arise from `eventsOf`, which sorts — but `classify` takes a list and must not
    // assume one. A negative gap is not a delay.
    expect(
      classify([
        { kind: 'element', elementId: 'a', startMs: 5000, endMs: 6000, label: 'a' },
        { kind: 'element', elementId: 'b', startMs: 1000, endMs: 2000, label: 'b' },
      ]).map((r) => r.kind),
    ).toEqual(['first', 'custom'])
  })
})

describe('across a whole slide', () => {
  it('returns one relationship per event, positionally aligned', () => {
    const events = eventsOf(slide([at(0, 1000), at(1000, 2000), at(2000, 3000)]))
    expect(classify(events)).toHaveLength(events.length)
  })

  it('classifies an empty slide as an empty list', () => {
    expect(classify([])).toEqual([])
  })

  it('is pure — the same events give the same answer', () => {
    const events = eventsOf(slide([at(0, 1000), at(1000, 2000)]))
    expect(classify(events)).toEqual(classify(events))
  })
})
