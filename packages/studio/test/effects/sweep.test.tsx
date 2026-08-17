import { act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { resolve, builtinEffects, createEffectRegistry } from '@cuestack/core'
import { renderEditor } from '../harness/editor.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * All eight, applied from the editor, each one visibly changing what the canvas renders.
 *
 * SC-006, and the shape of the `ELEMENT_TYPES` sweep feature 005 used to catch defaults that
 * had been guessed rather than read. Eight effects, eight assertions, driven from the list
 * itself — so a ninth cannot be registered without a decision here.
 *
 * "Visibly changes" is asserted against `resolve`, not against pixels: the resolver is what
 * the canvas renders through, and happy-dom has no compositor. A contribution that differs
 * from the element at rest is the honest form of the claim.
 */

const registry = createEffectRegistry(builtinEffects)

/** Everything a resolved element contributes, as one comparable value. */
const shapeOf = (state: ReturnType<typeof resolve>) => {
  const el = state.elements[0]
  return JSON.stringify({
    opacity: el?.opacity ?? null,
    transform: el?.transform ?? null,
    filter: el?.filter ?? null,
  })
}

describe('every registered effect is reachable from the editor (SC-006)', () => {
  it('covers all eight, from the registry rather than from a list here', () => {
    expect(registry.types()).toHaveLength(8)
  })

  it.each(registry.types())('adds %s and changes what the canvas renders', (type) => {
    const descriptor = registry.get(type)!
    const el = element({ startMs: 0, endMs: 8000 })
    const { handle } = renderEditor(lessonWith([el]))

    let added = false
    act(() => {
      const result = handle.session.apply({
        kind: 'add-effect',
        id: el.id,
        type,
        phase: descriptor.phases[0]!,
        startMs: 1000,
        durationMs: 1000,
      })
      added = result.ok
    })
    expect(added, `${type} was refused`).toBe(true)

    const slide = handle.session.draft.slides[0]!
    // A moment inside the effect's window, against the same slide with the effect removed.
    const during = resolve(slide, 1500)
    const bare = resolve(lessonWith([el]).slides[0]!, 1500)

    expect(shapeOf(during), `${type} contributed nothing at 1500 ms`).not.toBe(shapeOf(bare))
  })

  it('leaves every draft valid, effect by effect', () => {
    const el = element({ startMs: 0, endMs: 8000 })
    const { handle } = renderEditor(lessonWith([el]))

    for (const type of registry.types()) {
      const descriptor = registry.get(type)!
      act(() => {
        handle.session.apply({
          kind: 'add-effect',
          id: el.id,
          type,
          phase: descriptor.phases[0]!,
          startMs: 0,
          durationMs: 400,
        })
      })
    }
    const stored = (handle.session.draft.slides[0]!.elements[0] as unknown as { effects: unknown[] }).effects
    expect(stored).toHaveLength(8)
  })
})
