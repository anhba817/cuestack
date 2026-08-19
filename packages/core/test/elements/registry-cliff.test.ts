import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { createElementRegistry } from '../../src/elements/registry.js'
import { builtinElements } from '../../src/elements/builtin/index.js'
import { syntheticPlugin } from '../harness/plugins.js'
import { lessonOf } from '../harness/lesson.js'
import type { Slide } from '@cuestack/schema'

/**
 * The escape hatch this feature turns off, and the edge a host will meet.
 *
 * `resolveElement` reads `const known = plugin !== undefined || elements.types().length === 0` — an
 * **empty** registry treats every type as known. Before feature 009 the default registry was empty,
 * so `UNKNOWN_ELEMENT_TYPE` was unreachable in practice. Registering the seven makes it live.
 *
 * The consequence for a host is the sharp part: `resolve` reads `context?.elements ?? DEFAULT_ELEMENTS`,
 * so a supplied registry **replaces** the default rather than extending it. Registering one custom
 * type without composing the builtins reports the other seven as unknown.
 */
const slideWith = (type: string, over: Record<string, unknown> = {}): Slide => {
  const lesson = lessonOf({ slides: 1 })
  const element = { ...lesson.slides[0]!.elements[0]!, id: 'x', type, ...over }
  return { ...lesson.slides[0]!, elements: [element] } as unknown as Slide
}

describe('with the seven registered', () => {
  const registry = createElementRegistry(builtinElements)

  it('reports an eighth, unregistered type as unknown', () => {
    const state = resolve(slideWith('gauge'), 0, { elements: registry })
    expect(state.problems.map((p) => p.code)).toContain('UNKNOWN_ELEMENT_TYPE')
  })

  it('reports none of the seven as unknown', () => {
    for (const type of ['text', 'image', 'shape', 'video', 'audio', 'button', 'question']) {
      const state = resolve(slideWith(type), 0, { elements: registry })
      expect(state.problems.map((p) => p.code)).not.toContain('UNKNOWN_ELEMENT_TYPE')
    }
  })

  it('treats an unregistered *required question* as blocking rather than merely unknown', () => {
    // The asymmetry `resolveElement` already draws: losing a decoration and stranding a learner on
    // an unanswerable question are not comparable.
    const state = resolve(
      slideWith('custom-quiz', { payload: { required: true }, type: 'custom-quiz' }),
      0,
      { elements: registry },
    )
    expect(state.blocked?.code ?? state.problems[0]?.code).toBeTruthy()
  })
})

describe('a supplied registry replaces the default rather than extending it', () => {
  it('a registry holding only a custom plugin reports the seven MVP types as unknown', () => {
    // The edge a host meets, and the reason `createElementRegistry([...builtinElements, mine])`
    // moves from irrelevant to mandatory with this feature.
    const onlyMine = createElementRegistry([syntheticPlugin()])
    const state = resolve(slideWith('text'), 0, { elements: onlyMine })
    expect(state.problems.map((p) => p.code)).toContain('UNKNOWN_ELEMENT_TYPE')
  })

  it('composing them keeps every type known', () => {
    const composed = createElementRegistry([...builtinElements, syntheticPlugin()])
    for (const type of ['text', 'gauge']) {
      const state = resolve(slideWith(type), 0, { elements: composed })
      expect(state.problems.map((p) => p.code)).not.toContain('UNKNOWN_ELEMENT_TYPE')
    }
  })
})
