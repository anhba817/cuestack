import { describe, expect, it } from 'vitest'
import { createEffectRegistry, type EffectDescriptor } from '../../src/effects/registry.js'
import { builtinEffects } from '../../src/effects/builtin/index.js'
import { createElementRegistry } from '../../src/elements/registry.js'
import { resolve } from '../../src/resolve/index.js'
import { effect, slide, textElement } from '../harness/corpus.js'
import { syntheticEffect } from '../harness/plugins.js'

const skew: EffectDescriptor = {
  type: 'skew',
  phases: ['emphasis'],
  motion: true,
  defaultEasing: 'linear',
  at: (progress) => ({ rotate: progress * 30 }),
}

describe('a synthetic effect', () => {
  const context = () => ({
    effects: createEffectRegistry([...builtinEffects, skew]),
    elements: createElementRegistry(),
  })

  it('contributes to the resolved state', () => {
    const s = slide([
      textElement({
        startMs: 0,
        endMs: 4000,
        effects: [syntheticEffect({ type: 'skew', phase: 'emphasis', startMs: 0, durationMs: 1000, order: 1, easing: 'linear' })],
      }),
    ])
    expect(resolve(s, 500, context()).elements[0]!.transform.rotate).toBeCloseTo(15, 6)
  })

  it('reports its motion flag through activeEffects', () => {
    const s = slide([
      textElement({ startMs: 0, endMs: 4000, effects: [syntheticEffect({ type: 'skew', phase: 'emphasis', startMs: 0, durationMs: 1000, order: 1 })] }),
    ])
    expect(resolve(s, 500, context()).elements[0]!.activeEffects[0]!.motion).toBe(true)
  })

  it('composes with a built-in effect', () => {
    const s = slide([
      textElement({
        startMs: 0,
        endMs: 4000,
        effects: [
          syntheticEffect({ id: 'a', type: 'skew', phase: 'emphasis', startMs: 0, durationMs: 1000, order: 1, easing: 'linear' }),
          effect({ id: 'b', type: 'fade', phase: 'enter', startMs: 0, durationMs: 1000, order: 2, easing: 'linear' }),
        ],
      }),
    ])
    const el = resolve(s, 500, context()).elements[0]!
    expect(el.transform.rotate).toBeCloseTo(15, 6)
    expect(el.opacity).toBeCloseTo(0.5, 6)
  })

  it('an unregistered effect type is reported and contributes nothing', () => {
    const s = slide([
      textElement({ startMs: 0, endMs: 4000, effects: [syntheticEffect({ type: 'skew', phase: 'emphasis', startMs: 0, durationMs: 1000, order: 1 })] }),
    ])
    // Default registry has no 'skew'.
    const state = resolve(s, 500)
    expect(state.problems.map((p) => p.code)).toContain('UNKNOWN_EFFECT_TYPE')
    expect(state.elements[0]!.transform.rotate).toBe(0)
  })
})
