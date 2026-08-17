import { describe, expect, it } from 'vitest'
import { eventsOf, keyOf } from '../../src/sequence/events.js'
import { element, hidden, locked, slide } from '../harness/corpus.js'
import { effect, overlappingEffects, simultaneous } from '../harness/timeline.js'

/**
 * The unit a sequence orders: an element appearing, or an effect running.
 *
 * Not elements alone. UC-02 is titled *Create a Chronological Effect Sequence*, and a teacher
 * revealing a list one line at a time is sequencing **effects** — a mode that could only
 * order elements would send them to the timeline for the commonest case it exists to serve.
 *
 * Pure, in the `node` project. Constitution II names "Simple Sequence to absolute-time
 * conversion" among the things that MUST be developed test-first, and a pure function is the
 * only shape that lets that be honoured without a browser.
 */

describe('eventsOf', () => {
  it('gives one event per element, at its start', () => {
    const a = element({ startMs: 0, endMs: 2000 })
    const b = element({ startMs: 3000, endMs: 5000 })
    const events = eventsOf(slide([a, b]))

    expect(events).toHaveLength(2)
    expect(events.map((e) => e.kind)).toEqual(['element', 'element'])
    expect(events.map((e) => e.startMs)).toEqual([0, 3000])
  })

  it('gives one event per effect, beside the element that owns it', () => {
    const events = eventsOf(slide([overlappingEffects()]))
    // One element plus its two effects.
    expect(events).toHaveLength(3)
    expect(events.filter((e) => e.kind === 'effect')).toHaveLength(2)
  })

  it('orders by start time first', () => {
    const a = element({ startMs: 4000, endMs: 6000 })
    const b = element({ startMs: 1000, endMs: 2000 })
    expect(eventsOf(slide([a, b])).map((e) => e.startMs)).toEqual([1000, 4000])
  })

  it('breaks a tie by paint order, then by the effect’s own order', () => {
    const [first, second] = simultaneous()
    // zIndex 1 before zIndex 2 — the same tie-break `resolve` uses, so the sequence view and
    // playback never disagree about which of two simultaneous things is "previous".
    const events = eventsOf(slide([second!, first!]))
    expect(events.map((e) => e.elementId)).toEqual([first!.id, second!.id])
  })

  it('orders two effects sharing a start by their explicit order', () => {
    const el = element({
      startMs: 0,
      endMs: 8000,
      effects: [
        effect({ id: 'fx-b', startMs: 1000, order: 1 }),
        effect({ id: 'fx-a', startMs: 1000, order: 0 }),
      ],
    })
    const ids = eventsOf(slide([el]))
      .filter((e) => e.kind === 'effect')
      .map((e) => e.effectId)
    expect(ids).toEqual(['fx-a', 'fx-b'])
  })

  it('includes a hidden element, because hiding affects playback and not authoring order', () => {
    const events = eventsOf(slide([hidden()]))
    expect(events).toHaveLength(1)
  })

  it('includes a locked element — applying to it is what gets refused, not listing it', () => {
    expect(eventsOf(slide([locked()]))).toHaveLength(1)
  })

  it('produces nothing for an empty slide, and does not throw', () => {
    expect(eventsOf(slide([]))).toEqual([])
  })

  it('is total and stable — the same slide gives the same list every time', () => {
    const built = slide([element({ startMs: 1000, endMs: 2000 }), overlappingEffects()])
    expect(eventsOf(built)).toEqual(eventsOf(built))
  })
})

describe('an effect needs no conversion, because its time is slide time', () => {
  /**
   * Asserted rather than assumed. `Effect.startMs` is documented in the schema as relative to
   * *slide* time, not element time — which is the whole reason one ordered list can hold both
   * kinds of event. If it were element-relative, every effect's position would need the
   * owning element's start added, and a mode built on the raw value would be silently wrong
   * for every element that does not begin at zero.
   */
  it('takes the effect’s startMs verbatim', () => {
    const el = element({
      startMs: 5000,
      endMs: 8000,
      effects: [effect({ id: 'fx-1', startMs: 500, durationMs: 200 })],
    })
    const [effectEvent] = eventsOf(slide([el])).filter((e) => e.kind === 'effect')
    expect(effectEvent!.startMs).toBe(500)
    // Not 5500. An effect can legally precede the element it belongs to.
    expect(effectEvent!.startMs).not.toBe(5500)
  })

  it('orders an effect before its own element when the numbers say so', () => {
    const el = element({
      startMs: 5000,
      endMs: 8000,
      effects: [effect({ id: 'fx-1', startMs: 100, durationMs: 200 })],
    })
    expect(eventsOf(slide([el])).map((e) => e.kind)).toEqual(['effect', 'element'])
  })

  it('ends an effect event at start plus duration', () => {
    const el = element({ startMs: 0, endMs: 8000, effects: [effect({ startMs: 1000, durationMs: 750 })] })
    const [effectEvent] = eventsOf(slide([el])).filter((e) => e.kind === 'effect')
    expect(effectEvent!.endMs).toBe(1750)
  })
})

describe('keyOf', () => {
  it('is the element id for an element event', () => {
    const el = element()
    expect(keyOf(eventsOf(slide([el]))[0]!)).toBe(el.id)
  })

  it('joins element and effect for an effect event, because an event has no id of its own', () => {
    // Minting one would be storage, which Constitution III forbids for this mode (FR-029).
    const el = element({ startMs: 0, endMs: 8000, effects: [effect({ id: 'fx-7' })] })
    const effectEvent = eventsOf(slide([el])).find((e) => e.kind === 'effect')!
    expect(keyOf(effectEvent)).toBe(`${el.id}:fx-7`)
  })
})
