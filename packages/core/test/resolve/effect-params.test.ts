import { describe, expect, it } from 'vitest'
import { applyEasing, EASINGS } from '../../src/effects/easing.js'
import { createEffectRegistry } from '../../src/effects/registry.js'
import { builtinEffects, slide as slideEffect, zoom, pulse, highlight, dim } from '../../src/effects/builtin/index.js'

/**
 * The effects' parameters and easing curves. Under-tested by the first pass: the
 * eight effects were checked for *existence* and motion, but their parameters —
 * which is what an author actually configures — went unexercised.
 */
describe('easing curves', () => {
  it.each(Object.keys(EASINGS))('%s maps 0 to 0 and 1 to 1', (name) => {
    expect(applyEasing(0, name)).toBe(0)
    expect(applyEasing(1, name)).toBe(1)
  })

  it('ease-in trails linear at the midpoint, ease-out leads it', () => {
    expect(applyEasing(0.5, 'ease-in')).toBeLessThan(0.5)
    expect(applyEasing(0.5, 'ease-out')).toBeGreaterThan(0.5)
  })

  it('ease-in-out is symmetric about the midpoint', () => {
    expect(applyEasing(0.5, 'ease-in-out')).toBeCloseTo(0.5, 6)
    expect(applyEasing(0.25, 'ease-in-out')).toBeCloseTo(1 - applyEasing(0.75, 'ease-in-out'), 6)
  })

  it('step holds at 0 until the very end', () => {
    expect(applyEasing(0.99, 'step')).toBe(0)
    expect(applyEasing(1, 'step')).toBe(1)
  })

  it('falls back to linear for an unknown name rather than throwing', () => {
    // An authoring typo should not make a lesson unplayable.
    expect(applyEasing(0.4, 'wobble')).toBeCloseTo(0.4, 6)
    expect(applyEasing(0.4, undefined)).toBeCloseTo(0.4, 6)
  })

  it('clamps input outside [0, 1]', () => {
    expect(applyEasing(-1, 'linear')).toBe(0)
    expect(applyEasing(4, 'linear')).toBe(1)
  })
})

describe('effect parameters', () => {
  it('slide travels from each supported direction', () => {
    const at = (from: string) => slideEffect.at(0, { from, distance: 100 })
    expect(at('bottom').translate).toEqual({ x: 0, y: 100 })
    expect(at('top').translate).toEqual({ x: 0, y: -100 })
    expect(at('left').translate).toEqual({ x: -100, y: 0 })
    expect(at('right').translate).toEqual({ x: 100, y: 0 })
  })

  it('slide defaults to bottom and a 64px distance', () => {
    expect(slideEffect.at(0).translate).toEqual({ x: 0, y: 64 })
  })

  it('slide arrives at the authored position by completion', () => {
    expect(slideEffect.at(1, { from: 'left', distance: 200 }).translate).toEqual({ x: 0, y: 0 })
  })

  it('zoom honours a custom starting scale', () => {
    expect(zoom.at(0, { from: 0.5 }).scale).toEqual({ x: 0.5, y: 0.5 })
    expect(zoom.at(1, { from: 0.5 }).scale).toEqual({ x: 1, y: 1 })
  })

  it('zoom ignores a non-numeric parameter and uses its default', () => {
    expect(zoom.at(0, { from: 'big' as unknown as number }).scale).toEqual({ x: 0.92, y: 0.92 })
  })

  it('pulse swells and returns, honouring a custom amount', () => {
    expect(pulse.at(0).scale).toEqual({ x: 1, y: 1 })
    expect(pulse.at(1).scale).toEqual({ x: 1, y: 1 })
    expect(pulse.at(0.5, { amount: 0.5 }).scale!.x).toBeCloseTo(1.5, 6)
  })

  it('highlight peaks mid-effect and returns to neutral', () => {
    expect(highlight.at(0).brightness).toBe(1)
    expect(highlight.at(0.5, { amount: 1 }).brightness).toBeCloseTo(2, 6)
    expect(highlight.at(1).brightness).toBe(1)
  })

  it('dim deepens monotonically', () => {
    expect(dim.at(0).brightness).toBe(1)
    expect(dim.at(1, { amount: 0.5 }).brightness).toBeCloseTo(0.5, 6)
  })
})

describe('effect registry', () => {
  it('registers the built-ins and lists their types', () => {
    const registry = createEffectRegistry(builtinEffects)
    expect(registry.types()).toHaveLength(8)
    expect(registry.has('fade')).toBe(true)
    expect(registry.get('fade')?.type).toBe('fade')
  })

  it('returns undefined for an unregistered type rather than throwing', () => {
    expect(createEffectRegistry().get('nope')).toBeUndefined()
    expect(createEffectRegistry().has('nope')).toBe(false)
  })

  it('accepts a late registration', () => {
    const registry = createEffectRegistry()
    registry.register({ ...builtinEffects[0]!, type: 'custom' })
    expect(registry.has('custom')).toBe(true)
  })

  it('refuses an incomplete descriptor, naming what is missing', () => {
    const registry = createEffectRegistry()
    const partial = { type: 'broken', phases: ['enter'], motion: false } as never
    expect(() => registry.register(partial)).toThrow(/missing.*at|at.*missing/i)
  })

  it('refuses an incomplete descriptor at construction too', () => {
    const partial = { type: 'broken' } as never
    expect(() => createEffectRegistry([partial])).toThrow(/incomplete/i)
  })
})
