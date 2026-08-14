import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { effect, slide, textElement } from '../harness/corpus.js'

/** US1 #2: a 500ms fade from 1000ms reads halfway at 1250ms, and eased. */
describe('effect progress', () => {
  const s = slide([
    textElement({
      startMs: 1000,
      endMs: 8000,
      effects: [effect({ type: 'fade', phase: 'enter', startMs: 1000, durationMs: 500, order: 1, easing: 'linear' })],
    }),
  ])

  it('reports halfway at the midpoint', () => {
    const fx = resolve(s, 1250).elements[0]!.activeEffects[0]!
    expect(fx.progress).toBeCloseTo(0.5, 5)
  })

  it('reports the effect as active only within its window', () => {
    expect(resolve(s, 1000).elements[0]!.activeEffects).toHaveLength(1)
    expect(resolve(s, 1499).elements[0]!.activeEffects).toHaveLength(1)
    expect(resolve(s, 1500).elements[0]!.activeEffects).toHaveLength(0)
  })

  it('applies easing rather than raw linear position', () => {
    const eased = slide([
      textElement({
        startMs: 0,
        endMs: 2000,
        effects: [effect({ type: 'fade', startMs: 0, durationMs: 1000, order: 1, easing: 'ease-out' })],
      }),
    ])
    const fx = resolve(eased, 500).elements[0]!.activeEffects[0]!
    // ease-out is ahead of linear at the midpoint; equality would mean easing was ignored.
    expect(fx.progress).toBeGreaterThan(0.5)
  })

  it('carries the motion flag through to the resolved state', () => {
    const moving = slide([
      textElement({ startMs: 0, endMs: 2000, effects: [effect({ type: 'slide', startMs: 0, durationMs: 500, order: 1 })] }),
    ])
    expect(resolve(moving, 250).elements[0]!.activeEffects[0]!.motion).toBe(true)
    expect(resolve(s, 1250).elements[0]!.activeEffects[0]!.motion).toBe(false)
  })
})
