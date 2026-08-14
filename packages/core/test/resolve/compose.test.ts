import { describe, expect, it } from 'vitest'
import { composeContributions } from '../../src/resolve/compose.js'
import { resolve } from '../../src/resolve/index.js'
import { effect, slide, textElement } from '../harness/corpus.js'
import type { Contribution } from '../../src/resolve/contribution.js'

/**
 * Research R-02: contributions compose associatively and commutatively, which
 * makes FR-010's ordering a safety net rather than the only thing preventing a
 * slide from looking different on a second viewing.
 */
describe('contribution composition', () => {
  const a: Contribution = { opacity: 0.5, translate: { x: 10, y: 0 }, rotate: 15 }
  const b: Contribution = { opacity: 0.4, translate: { x: -4, y: 6 }, scale: { x: 2, y: 2 } }
  const c: Contribution = { brightness: 1.5, blur: 3 }

  it('is commutative', () => {
    expect(composeContributions([a, b, c])).toEqual(composeContributions([c, b, a]))
  })

  it('is order-independent across every permutation', () => {
    // Associativity cannot be asserted by re-feeding output back in —
    // composeContributions returns a ComposedVisual, not a Contribution, and
    // pretending otherwise would be a type lie. Order-independence over all
    // permutations is the property that matters and is reachable through the
    // public API.
    const permutations = [
      [a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a],
    ]
    const expected = JSON.stringify(composeContributions(permutations[0]!))
    for (const p of permutations) {
      expect(JSON.stringify(composeContributions(p))).toBe(expected)
    }
  })

  it('treats the empty set as the identity', () => {
    const identity = composeContributions([])
    expect(identity.opacity).toBe(1)
    expect(identity.transform).toEqual({ translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotate: 0 })
    expect(identity.filter).toBeNull()
  })

  it('multiplies opacities and sums translations', () => {
    const composed = composeContributions([a, b])
    expect(composed.opacity).toBeCloseTo(0.2, 6)
    expect(composed.transform.translateX).toBe(6)
    expect(composed.transform.translateY).toBe(6)
    expect(composed.transform.scaleX).toBe(2)
    expect(composed.transform.rotate).toBe(15)
  })

  it('produces the same rendered result whichever order effects are declared in', () => {
    const forwards = slide([
      textElement({
        startMs: 0,
        endMs: 4000,
        effects: [
          effect({ id: 'a', type: 'fade', startMs: 1000, durationMs: 800, order: 1 }),
          effect({ id: 'b', type: 'zoom', startMs: 1000, durationMs: 800, order: 2 }),
        ],
      }),
    ])
    const backwards = slide([
      textElement({
        startMs: 0,
        endMs: 4000,
        effects: [
          effect({ id: 'b', type: 'zoom', startMs: 1000, durationMs: 800, order: 2 }),
          effect({ id: 'a', type: 'fade', startMs: 1000, durationMs: 800, order: 1 }),
        ],
      }),
    ])
    const f = resolve(forwards, 1400).elements[0]!
    const b2 = resolve(backwards, 1400).elements[0]!
    expect(f.opacity).toBeCloseTo(b2.opacity, 10)
    expect(f.transform).toEqual(b2.transform)
  })
})

/**
 * FR-010. Commutative composition makes ordering unobservable in the visual
 * output, so the requirement is verified where it IS observable: the order
 * activeEffects arrives in. A future non-commutative effect depends on this.
 */
describe('activeEffects ordering', () => {
  it('is sorted by (startMs, order) regardless of declaration order', () => {
    const s = slide([
      textElement({
        startMs: 0,
        endMs: 5000,
        effects: [
          effect({ id: 'late', startMs: 2000, durationMs: 2000, order: 1 }),
          effect({ id: 'second', startMs: 1000, durationMs: 3000, order: 2 }),
          effect({ id: 'first', startMs: 1000, durationMs: 3000, order: 1 }),
        ],
      }),
    ])
    const ids = resolve(s, 2500).elements[0]!.activeEffects.map((f) => f.id)
    expect(ids).toEqual(['first', 'second', 'late'])
  })

  it('is stable across repeated resolutions', () => {
    const s = slide([
      textElement({
        startMs: 0,
        endMs: 5000,
        effects: [
          effect({ id: 'x', startMs: 0, durationMs: 5000, order: 2 }),
          effect({ id: 'y', startMs: 0, durationMs: 5000, order: 1 }),
        ],
      }),
    ])
    const once = resolve(s, 100).elements[0]!.activeEffects.map((f) => f.id)
    const twice = resolve(s, 100).elements[0]!.activeEffects.map((f) => f.id)
    expect(once).toEqual(twice)
    expect(once).toEqual(['y', 'x'])
  })
})
