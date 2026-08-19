import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { createElementRegistry } from '../../src/elements/registry.js'
import { builtinElements } from '../../src/elements/builtin/index.js'
import { lessonOf } from '../harness/lesson.js'

/**
 * Registering the seven changes nothing a learner sees.
 *
 * This is the guard that lets feature 009 add seven plugins inside a feature about validation.
 * `resolve/element.ts` composes `plugin.resolve`'s contribution, so a plugin returning geometry or
 * style would change what every lesson renders — at the moment the work is supposed to be adding
 * *checks*. Each builtin therefore returns `{ visible: true }` with no contribution, which is
 * exactly what the code already produces when no plugin exists (FR-006b, SC-001a).
 *
 * Delete a plugin's inert `resolve` and replace it with a contribution, and this fails while
 * everything else passes — which is why it is one of T069's negative controls.
 */
describe('the builtin plugins are invisible to playback', () => {
  const empty = createElementRegistry()
  const registered = createElementRegistry(builtinElements)

  const lesson = lessonOf({ slides: 3 })

  it('produces an identical RenderState with and without them', () => {
    for (const slide of lesson.slides) {
      for (const atMs of [0, 1, 500, 4000, 7999]) {
        const without = resolve(slide, atMs, { elements: empty })
        const withThem = resolve(slide, atMs, { elements: registered })
        expect(withThem).toEqual(without)
      }
    }
  })

  it('and identical to resolving with no context at all', () => {
    // The default registry is now the seven, so this is the path a host actually takes.
    for (const slide of lesson.slides) {
      expect(resolve(slide, 0)).toEqual(resolve(slide, 0, { elements: empty }))
    }
  })

  it('every builtin resolve is visible and contributes nothing', () => {
    // Asserted directly as well as through `resolve`, because the composition above would also
    // pass if a contribution happened to compose to the same values today.
    for (const p of builtinElements) {
      const outcome = p.resolve({
        payload: {},
        geometry: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
        slideTimeMs: 0,
        theme: {},
      })
      expect(outcome.visible).toBe(true)
      expect(outcome.contribution).toBeUndefined()
    }
  })

  it('registers all seven MVP types and nothing else', () => {
    expect([...registered.types()].sort()).toEqual(
      ['audio', 'button', 'image', 'question', 'shape', 'text', 'video'],
    )
  })
})
