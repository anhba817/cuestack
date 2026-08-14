import { describe, expect, it } from 'vitest'
import { createElementRegistry } from '../../src/elements/registry.js'
import { createEffectRegistry } from '../../src/effects/registry.js'
import { builtinEffects } from '../../src/effects/builtin/index.js'
import { resolve } from '../../src/resolve/index.js'
import { effect, slide, textElement } from '../harness/corpus.js'
import { syntheticElement, syntheticPlugin } from '../harness/plugins.js'

/**
 * SC-007: a registered type participates exactly as a built-in does.
 *
 * Written so it would fail if the resolver had to know about the type — the
 * synthetic type appears nowhere in src/, so if resolution worked it can only be
 * through the registry.
 */
describe('a synthetic element type', () => {
  const context = () => ({
    elements: createElementRegistry([syntheticPlugin(), syntheticPlugin({ type: 'text' })]),
    effects: createEffectRegistry(builtinEffects),
  })

  it('participates in timing exactly as a built-in does', () => {
    const s = slide([
      syntheticElement({ id: 'g', type: 'gauge', startMs: 1000, endMs: 3000, effects: [], payload: { value: 4 } }),
    ])
    expect(resolve(s, 999, context()).elements).toHaveLength(0)
    expect(resolve(s, 1000, context()).elements).toHaveLength(1)
    expect(resolve(s, 3000, context()).elements).toHaveLength(0)
  })

  it('participates in layering exactly as a built-in does', () => {
    const s = slide([
      syntheticElement({ id: 'g', type: 'gauge', zIndex: 9, effects: [], payload: {} }),
      textElement({ id: 't', zIndex: 1, effects: [] }),
    ])
    expect(resolve(s, 0, context()).elements.map((e) => e.id)).toEqual(['t', 'g'])
  })

  it('composes with built-in effects', () => {
    const s = slide([
      syntheticElement({
        id: 'g',
        type: 'gauge',
        startMs: 0,
        endMs: 4000,
        payload: {},
        effects: [effect({ type: 'fade', startMs: 0, durationMs: 1000, order: 1, easing: 'linear' })],
      }),
    ])
    // The plugin contributes 0.6 opacity; a half-complete linear fade contributes
    // 0.5. Composition multiplies, so neither wins — both apply.
    const el = resolve(s, 500, context()).elements[0]!
    expect(el.opacity).toBeCloseTo(0.3, 6)
  })

  it('is reported as available', () => {
    const s = slide([syntheticElement({ id: 'g', type: 'gauge', effects: [], payload: {} })])
    expect(resolve(s, 0, context()).elements[0]!.available).toBe(true)
  })

  it('can decide its own invisibility beyond the timing window', () => {
    const hidden = createElementRegistry([
      syntheticPlugin({ resolve: () => ({ visible: false }) }),
      syntheticPlugin({ type: 'text' }),
    ])
    const s = slide([syntheticElement({ id: 'g', type: 'gauge', effects: [], payload: {} })])
    expect(resolve(s, 0, { elements: hidden, effects: createEffectRegistry(builtinEffects) }).elements).toHaveLength(0)
  })

  it('the resolver contains no mention of the synthetic type', async () => {
    // The actual claim of SC-007. If the resolver named 'gauge' anywhere, the
    // tests above would pass for the wrong reason.
    const { readFileSync, readdirSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const root = new URL('../../src', import.meta.url).pathname
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const f = join(dir, n)
        return statSync(f).isDirectory() ? walk(f) : f.endsWith('.ts') ? [f] : []
      })
    const offenders = walk(root).filter((f) => readFileSync(f, 'utf8').includes('gauge'))
    expect(offenders).toEqual([])
  })
})
