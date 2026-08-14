import { describe, expect, it } from 'vitest'
import { createElementRegistry } from '../../src/elements/registry.js'
import { createEffectRegistry } from '../../src/effects/registry.js'
import { builtinEffects } from '../../src/effects/builtin/index.js'
import { resolve } from '../../src/resolve/index.js'
import { slide, textElement } from '../harness/corpus.js'
import { syntheticElement, syntheticPlugin } from '../harness/plugins.js'
import type { ElementResolveInput } from '../../src/elements/contract.js'

/**
 * FR-029: a plugin receives only its own element and the theme.
 *
 * Not about trust — most plugins will be first-party. The point is that a plugin
 * *able* to read the whole lesson becomes one that does, and then the lesson shape
 * cannot change without breaking third-party code.
 */
describe('plugin isolation', () => {
  function capture() {
    const seen: ElementResolveInput[] = []
    const elements = createElementRegistry([
      syntheticPlugin({
        resolve: (input) => {
          seen.push(input as ElementResolveInput)
          return { visible: true }
        },
      }),
      syntheticPlugin({ type: 'text' }),
    ])
    return { seen, context: { elements, effects: createEffectRegistry(builtinEffects) } }
  }

  const twoElementSlide = slide([
    syntheticElement({ id: 'g', type: 'gauge', x: 10, y: 20, width: 30, height: 40, effects: [], payload: { mine: true } }),
    textElement({ id: 'sibling', effects: [], payload: { text: 'not yours' } }),
  ])

  it('receives exactly four keys and no more', () => {
    const { seen, context } = capture()
    resolve(twoElementSlide, 100, { ...context, theme: { 'colour.text': '#111' } })
    expect(Object.keys(seen[0]!).sort()).toEqual(['geometry', 'payload', 'slideTimeMs', 'theme'])
  })

  it('receives its own payload and geometry', () => {
    const { seen, context } = capture()
    resolve(twoElementSlide, 100, context)
    expect(seen[0]!.payload).toEqual({ mine: true })
    expect(seen[0]!.geometry).toEqual({ x: 10, y: 20, width: 30, height: 40, rotation: 0 })
  })

  it('receives the theme', () => {
    const { seen, context } = capture()
    resolve(twoElementSlide, 100, { ...context, theme: { 'colour.text': '#111' } })
    expect(seen[0]!.theme).toEqual({ 'colour.text': '#111' })
  })

  it('never sees the lesson, the slide, or a sibling element', () => {
    const { seen, context } = capture()
    resolve(twoElementSlide, 100, context)
    const serialized = JSON.stringify(seen[0])
    expect(serialized).not.toContain('not yours')
    expect(serialized).not.toContain('sibling')
    expect(serialized).not.toContain(twoElementSlide.id)
  })

  it('never sees anything describing the learner or the transport', () => {
    const { seen, context } = capture()
    resolve(twoElementSlide, 100, context)
    for (const forbidden of ['learner', 'instanceId', 'transport', 'state']) {
      expect(Object.keys(seen[0]!)).not.toContain(forbidden)
    }
  })
})
