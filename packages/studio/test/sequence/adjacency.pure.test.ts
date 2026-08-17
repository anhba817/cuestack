import { describe, expect, it } from 'vitest'
import { classify, resolveSequence } from '../../src/sequence/relationships.js'
import { eventsOf, keyOf } from '../../src/sequence/events.js'
import { element, slide } from '../harness/corpus.js'
import { effect } from '../harness/timeline.js'

/**
 * A relationship is expressible between **any two adjacent events** (FR-036).
 *
 * Four shapes, and they must behave identically: element→element, effect→effect on one
 * element, element→effect, and effect→element. `classify` reads neither event's `kind`, so
 * that is true by construction — and this suite is what proves the construction rather than
 * the intention.
 *
 * Stated as its own file because it is otherwise the requirement most likely to be
 * half-built. An implementation that special-cased "the previous event belongs to the same
 * element" would pass every other assertion in this directory and fail only here.
 */

const kindsFor = (elements: ReturnType<typeof element>[]) =>
  classify(eventsOf(slide(elements))).map((r) => r.kind)

describe('the four adjacency shapes', () => {
  it('element → element', () => {
    const a = element({ startMs: 0, endMs: 2000 })
    const b = element({ startMs: 2000, endMs: 4000 })
    expect(kindsFor([a, b])).toEqual(['first', 'after-previous'])
  })

  it('effect → effect, on one element', () => {
    // The reveal-a-list case UC-02 is about: one element, several effects, one after another.
    //
    // The element's window has to *end* where the first effect begins, or the effect overlaps
    // its own element and classifies as Custom — correctly. That is worth stating because it
    // was this test's first fixture and the failure looked like a bug in `classify` until the
    // numbers were read: an effect running *inside* its element's window is neither with nor
    // after the element's appearance.
    const el = element({
      startMs: 0,
      endMs: 1000,
      effects: [
        effect({ id: 'fx-1', startMs: 1000, durationMs: 500, order: 0 }),
        effect({ id: 'fx-2', startMs: 1500, durationMs: 500, order: 1 }),
      ],
    })
    expect(kindsFor([el])).toEqual(['first', 'after-previous', 'after-previous'])
  })

  it('element → effect', () => {
    // An element arriving, then something emphasising it.
    const el = element({
      startMs: 0,
      endMs: 8000,
      effects: [effect({ id: 'fx-1', startMs: 8000, durationMs: 400 })],
    })
    expect(kindsFor([el])).toEqual(['first', 'after-previous'])
  })

  it('effect → element', () => {
    // An effect finishing, then the next element arriving.
    const owner = element({ startMs: 0, endMs: 1000, effects: [effect({ id: 'fx-1', startMs: 0, durationMs: 500 })] })
    const next = element({ startMs: 500, endMs: 2000 })
    const kinds = kindsFor([owner, next])
    // element(0) → effect(0, with-previous) → element(500, after the effect's end)
    expect(kinds).toEqual(['first', 'with-previous', 'after-previous'])
  })
})

describe('every shape resolves the same way too', () => {
  it('places an effect after an element, and an element after an effect', () => {
    const owner = element({ startMs: 0, endMs: 1000, effects: [effect({ id: 'fx-1', startMs: 4000, durationMs: 500 })] })
    const next = element({ startMs: 7000, endMs: 9000 })
    const events = eventsOf(slide([owner, next]))

    const changes = resolveSequence(events, [
      { kind: 'first' },
      { kind: 'after-previous' },
      { kind: 'after-previous' },
    ])

    // element [0,1000) → effect at 1000 (500 long) → element at 1500.
    expect(changes.map((c) => c.startMs)).toEqual([0, 1000, 1500])
  })

  it('writes an end for an element event and none for an effect event', () => {
    const owner = element({ startMs: 0, endMs: 1000, effects: [effect({ id: 'fx-1', startMs: 2000, durationMs: 300 })] })
    const events = eventsOf(slide([owner]))
    const changes = resolveSequence(events, classify(events))

    const forElement = changes.find((c) => !c.eventKey.includes(':'))!
    const forEffect = changes.find((c) => c.eventKey.includes(':'))!
    expect(forElement.endMs).toBeDefined()
    expect(forEffect.endMs).toBeUndefined()
  })
})

describe('classify never asks what kind of event it is looking at', () => {
  it('gives the same answer for two events with identical times, whatever their kinds', () => {
    // The construction proof. Two pairs with the same numbers and different kinds must
    // classify identically, or a branch on `kind` has crept in.
    const elementPair = eventsOf(
      slide([element({ startMs: 0, endMs: 1000 }), element({ startMs: 1000, endMs: 2000 })]),
    )
    const effectPair = eventsOf(
      slide([
        element({
          startMs: 0,
          endMs: 1000,
          effects: [effect({ id: 'fx-1', startMs: 1000, durationMs: 1000 })],
        }),
      ]),
    )

    expect(elementPair.map((e) => [e.startMs, e.endMs])).toEqual(effectPair.map((e) => [e.startMs, e.endMs]))
    expect(classify(elementPair)).toEqual(classify(effectPair))
  })

  it('keys an effect event distinctly, so a mixed list addresses each one unambiguously', () => {
    const el = element({ startMs: 0, endMs: 8000, effects: [effect({ id: 'fx-1' })] })
    const keys = eventsOf(slide([el])).map(keyOf)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
