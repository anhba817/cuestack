import { describe, expect, it } from 'vitest'
import { builtinEffects } from '../../src/effects/builtin/index.js'
import { composeContributions } from '../../src/resolve/compose.js'

/** US1 #7, FR-012, SC-011: all eight effects work and declare whether they move. */
const EXPECTED = ['appear', 'fade', 'slide', 'zoom', 'pulse', 'highlight', 'dim', 'disappear']

describe('the MVP effect set', () => {
  it('contains exactly the eight named effects', () => {
    expect(builtinEffects.map((e) => e.type).sort()).toEqual([...EXPECTED].sort())
  })

  it.each(builtinEffects.map((e) => [e.type, e] as const))(
    '%s yields a visible contribution part-way through',
    (_type, descriptor) => {
      const mid = descriptor.at(0.5)
      const composed = composeContributions([mid])
      const identity = composeContributions([])
      expect(JSON.stringify(composed)).not.toBe(JSON.stringify(identity))
    },
  )

  it.each(builtinEffects.map((e) => [e.type, e] as const))(
    '%s is defined at both endpoints',
    (_type, descriptor) => {
      for (const p of [0, 1]) {
        expect(() => descriptor.at(p)).not.toThrow()
        expect(descriptor.at(p)).toBeTypeOf('object')
      }
    },
  )

  it('declares motion for every effect, so no consumer needs its own list', () => {
    for (const e of builtinEffects) expect(typeof e.motion).toBe('boolean')
  })

  it('classifies the movers as motion and the rest as not', () => {
    const byType = new Map(builtinEffects.map((e) => [e.type, e.motion]))
    expect(byType.get('slide')).toBe(true)
    expect(byType.get('zoom')).toBe(true)
    expect(byType.get('pulse')).toBe(true)
    expect(byType.get('fade')).toBe(false)
    expect(byType.get('appear')).toBe(false)
    expect(byType.get('disappear')).toBe(false)
    expect(byType.get('highlight')).toBe(false)
    expect(byType.get('dim')).toBe(false)
  })

  it('names the phases each effect is valid in', () => {
    for (const e of builtinEffects) {
      expect(e.phases.length).toBeGreaterThan(0)
      for (const p of e.phases) expect(['enter', 'emphasis', 'exit']).toContain(p)
    }
  })
})
