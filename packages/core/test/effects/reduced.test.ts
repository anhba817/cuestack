import { describe, expect, it } from 'vitest'
import { createEffectRegistry } from '../../src/effects/registry.js'
import { slide, zoom } from '../../src/effects/builtin/transform.js'
import { pulse } from '../../src/effects/builtin/pulse.js'
import { fade } from '../../src/effects/builtin/opacity.js'
import type { EffectDescriptor } from '../../src/effects/registry.js'

/**
 * An effect declares what it becomes when a learner has asked for less motion.
 *
 * On the descriptor, because only the effect knows. A substitution table held by a consumer
 * would be the list feature 002's research R-09 warned about — the one that rots the first
 * time a ninth effect is registered — and it would rot worse than the `motion` boolean it
 * warned about, because it carries more information.
 */

describe('an effect that declares a reduced form', () => {
  it('is offered by the moving built-ins', () => {
    for (const effect of [slide, zoom]) {
      expect(effect.reduced, `${effect.type} declares no reduced form`).toBeDefined()
    }
  })

  it('reaches its end state at the same moment as the effect it replaces', () => {
    // FR-026: substitution preserves *timing*. A reduced form that finished early would
    // change when content appears, which is the meaning a learner is entitled to keep.
    for (const effect of [slide, zoom, pulse]) {
      const full = effect.at(1)
      const reduced = effect.reduced!(1)
      expect(reduced.opacity ?? 1, `${effect.type} at progress 1`).toBe(full.opacity ?? 1)
    }
  })

  it('starts where the effect it replaces starts', () => {
    for (const effect of [slide, zoom]) {
      expect(effect.reduced!(0).opacity, `${effect.type} at progress 0`).toBe(effect.at(0).opacity)
    }
  })

  it('contributes no movement', () => {
    // The whole point. A reduced form that still translated or scaled would be a shorter
    // version of the motion rather than a substitute for it.
    for (const effect of [slide, zoom, pulse]) {
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        const contribution = effect.reduced!(progress)
        expect(contribution.translate, `${effect.type} translates at ${progress}`).toBeUndefined()
        expect(contribution.scale, `${effect.type} scales at ${progress}`).toBeUndefined()
        expect(contribution.rotate, `${effect.type} rotates at ${progress}`).toBeUndefined()
      }
    }
  })
})

describe('an effect that does not move', () => {
  it('declares no reduced form, because there is nothing to reduce', () => {
    expect(fade.motion).toBe(false)
    expect(fade.reduced).toBeUndefined()
  })
})

describe('the registry', () => {
  const base: EffectDescriptor = {
    type: 'probe',
    phases: ['enter'],
    motion: false,
    defaultEasing: 'linear',
    at: () => ({ opacity: 1 }),
  }

  it('accepts a moving effect with a reduced form', () => {
    expect(() =>
      createEffectRegistry([{ ...base, motion: true, reduced: () => ({ opacity: 1 }) }]),
    ).not.toThrow()
  })

  it('accepts a moving effect without one, falling back to no motion', () => {
    // Wave 2's blunt floor, kept as the floor for an effect whose author has not thought
    // about it. Rejecting these would make declaring a reduced form mandatory, which would
    // block registering a third-party effect over a refinement.
    expect(() => createEffectRegistry([{ ...base, motion: true }])).not.toThrow()
  })

  it('rejects a reduced form on an effect that does not move', () => {
    // It would never be consulted. A descriptor that carries one is describing something
    // that cannot happen, and the author has misunderstood which flag they wanted.
    expect(() =>
      createEffectRegistry([{ ...base, motion: false, reduced: () => ({ opacity: 1 }) }]),
    ).toThrow(/motion/i)
  })
})
