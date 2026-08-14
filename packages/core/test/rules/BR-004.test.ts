import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { effect, slide, textElement } from '../harness/corpus.js'

/** BR-004 — a positive effect duration yields well-defined progress at every instant. */
describe('BR-004', () => {
  it('progress is defined at the start, middle, and end of an effect', () => {
    const s = slide([
      textElement({
        startMs: 0,
        endMs: 2000,
        effects: [effect({ type: 'fade', startMs: 0, durationMs: 400, order: 1, easing: 'linear' })],
      }),
    ])
    for (const [t, expected] of [[0, 0], [200, 0.5], [400, 1]] as const) {
      const el = resolve(s, t).elements[0]!
      const fx = el.activeEffects[0]
      if (t === 400) {
        // At completion the effect is no longer active; its result is folded in.
        expect(el.opacity).toBe(1)
      } else {
        expect(fx?.progress).toBeCloseTo(expected, 5)
      }
    }
  })

  it('progress never falls outside [0, 1]', () => {
    const s = slide([
      textElement({
        startMs: 0,
        endMs: 3000,
        effects: [effect({ startMs: 500, durationMs: 300, order: 1 })],
      }),
    ])
    for (let t = 0; t <= 3000; t += 25) {
      for (const fx of resolve(s, t).elements[0]?.activeEffects ?? []) {
        expect(fx.progress).toBeGreaterThanOrEqual(0)
        expect(fx.progress).toBeLessThanOrEqual(1)
      }
    }
  })
})
