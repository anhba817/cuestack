import { describe, expect, it } from 'vitest'
import { createElementRegistry } from '../../src/elements/registry.js'
import { createEffectRegistry } from '../../src/effects/registry.js'
import { builtinEffects } from '../../src/effects/builtin/index.js'
import { resolve } from '../../src/resolve/index.js'
import { slide, textElement } from '../harness/corpus.js'
import { syntheticElement, syntheticPlugin } from '../harness/plugins.js'

/**
 * FR-027: an unregistered optional type degrades, leaving the rest of the slide
 * usable. Shipping a lesson to a host that lacks your plugin loses your element,
 * not the lesson.
 */
const context = () => ({
  elements: createElementRegistry([syntheticPlugin({ type: 'text' })]),
  effects: createEffectRegistry(builtinEffects),
})

describe('an unregistered optional type', () => {
  const s = slide([
    textElement({ id: 'known', effects: [] }),
    syntheticElement({ id: 'exotic', type: 'hologram', effects: [], payload: {} }),
    textElement({ id: 'also-known', effects: [] }),
  ])

  it('does not fail the slide', () => {
    expect(resolve(s, 0, context()).blocked).toBeNull()
  })

  it('leaves the other elements resolvable', () => {
    const ids = resolve(s, 0, context()).elements.map((e) => e.id)
    expect(ids).toContain('known')
    expect(ids).toContain('also-known')
  })

  it('marks the unknown element unavailable rather than omitting it silently', () => {
    const exotic = resolve(s, 0, context()).elements.find((e) => e.id === 'exotic')
    expect(exotic).toBeDefined()
    expect(exotic?.available).toBe(false)
  })

  it('reports the unknown type as a problem, naming it', () => {
    const problem = resolve(s, 0, context()).problems.find((p) => p.code === 'UNKNOWN_ELEMENT_TYPE')
    expect(problem?.elementId).toBe('exotic')
    expect(problem?.message).toContain('hologram')
  })
})
