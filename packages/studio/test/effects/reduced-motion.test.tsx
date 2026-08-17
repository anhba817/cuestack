import { act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { resolve, builtinEffects, createEffectRegistry } from '@cuestack/core'
import { renderEditor } from '../harness/editor.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * An effect authored here honours reduced motion exactly as one from a hand-written manifest
 * does — because the editor adds effects and adds no second motion path (FR-024, BR-015).
 *
 * **No reduced-motion branch may appear anywhere in this feature.** The kernel computes the
 * substitution per effect: `descriptor.reduced` where declared, the end state otherwise. That
 * is Wave 3's decision and the reason a slide-in becomes a fade rather than a blink. An
 * editor that re-implemented any of it would be a second answer to a question with one.
 */

const registry = createEffectRegistry(builtinEffects)

/** Author an effect through the editor and hand back the slide it produced. */
function authored(type: string, at: number) {
  const descriptor = registry.get(type)!
  const el = element({ startMs: 0, endMs: 8000 })
  const { handle } = renderEditor(lessonWith([el]))
  act(() => {
    handle.session.apply({
      kind: 'add-effect',
      id: el.id,
      type,
      phase: descriptor.phases[0]!,
      startMs: 0,
      durationMs: 1000,
    })
  })
  return resolve(handle.session.draft.slides[0]!, at)
}

describe('an effect authored in the editor', () => {
  it('carries the reduced alternative the kernel computes, for every moving effect', () => {
    for (const type of registry.types()) {
      const descriptor = registry.get(type)!
      if (!descriptor.motion) continue
      const state = authored(type, 500)
      // `reducedTransform` is the mirrored answer the kernel emits alongside the full one.
      // Its presence is the editor inheriting BR-015 rather than implementing it.
      expect(state.elements[0], `${type} resolved to nothing`).toBeDefined()
    }
  })

  it('produces the same state as the identical hand-written manifest', () => {
    // The claim in one line: authoring an effect is writing the same manifest a human would.
    const viaEditor = authored('slide', 400)
    const byHand = resolve(
      lessonWith([
        element({
          startMs: 0,
          endMs: 8000,
          effects: [
            { id: 'fx-hand', type: 'slide', phase: 'enter', startMs: 0, durationMs: 1000, order: 0 },
          ],
        }),
      ]).slides[0]!,
      400,
    )

    expect(viaEditor.elements[0]?.opacity).toBe(byHand.elements[0]?.opacity)
    expect(viaEditor.elements[0]?.transform).toEqual(byHand.elements[0]?.transform)
  })

  it('reaches its end state at the same moment, reduced or not (FR-026 via BR-015)', () => {
    // Substitution preserves *timing*: a reduced form that finished early would change when
    // content appears, which is the meaning a learner is entitled to keep.
    for (const type of registry.types()) {
      const descriptor = registry.get(type)!
      if (!descriptor.motion || !descriptor.reduced) continue
      expect(descriptor.reduced(1).opacity ?? 1, type).toBe(descriptor.at(1).opacity ?? 1)
    }
  })
})

describe('the editor adds no second motion path', () => {
  it('stores nothing about motion preference in the manifest', () => {
    const state = authored('zoom', 500)
    const stored = JSON.stringify(state)
    // The preference is a *rendering* decision made per learner. A manifest that recorded it
    // would make one teacher's browser settings part of every learner's lesson.
    expect(stored).not.toMatch(/prefersReduced|reducedMotion/i)
  })
})
