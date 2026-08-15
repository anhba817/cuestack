import { describe, expect, it } from 'vitest'
import { builtinEffects } from '../../src/effects/builtin/index.js'

/**
 * BR-015 — when reduced motion is active, nonessential movement is replaced with reduced or
 * instant alternatives.
 *
 * Asserted across **every registered moving effect** rather than the two that happen to
 * exist, so a ninth effect added without a substitution fails here rather than silently
 * falling back to appearing instantly.
 */

const moving = builtinEffects.filter((e) => e.motion)

describe('BR-015', () => {
  it('has moving effects to check', () => {
    expect(moving.length).toBeGreaterThan(0)
  })

  it.each(moving.map((e) => [e.type, e] as const))(
    '%s declares a reduced alternative',
    (_type, effect) => {
      expect(effect.reduced).toBeDefined()
    },
  )

  it.each(moving.map((e) => [e.type, e] as const))(
    '%s never hides the element it is reducing',
    (_type, effect) => {
      // FR-027: a substitution must not remove information. A reduced form ending at zero
      // opacity has made the content unreachable, which is worse than the motion it replaced.
      expect(effect.reduced!(1).opacity ?? 1).toBeGreaterThan(0)
    },
  )

  it.each(moving.map((e) => [e.type, e] as const))(
    '%s never moves the element outside the stage',
    (_type, effect) => {
      for (const progress of [0, 0.5, 1]) {
        const contribution = effect.reduced!(progress)
        expect(contribution.translate).toBeUndefined()
        expect(contribution.scale).toBeUndefined()
      }
    },
  )

  it.each(moving.map((e) => [e.type, e] as const))(
    '%s is pure — the same progress gives the same contribution',
    (_type, effect) => {
      // Called from the resolver, on a server, per frame. Same contract as `at`.
      expect(effect.reduced!(0.4)).toEqual(effect.reduced!(0.4))
    },
  )
})
