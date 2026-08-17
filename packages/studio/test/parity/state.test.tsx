import { describe, expect, it } from 'vitest'
import { resolve } from '@cuestack/core'
import { element, lessonWith, oneOfEachType } from '../harness/corpus.js'
import { fakePorts, renderEditor, runFrames } from '../harness/editor.js'
import { timelineLesson } from '../harness/timeline.js'
import { act } from '@testing-library/react'

/**
 * T039 — SC-004: the canvas shows the lesson, not an approximation of it.
 *
 * What this adds over `geometry.test.tsx`. Comparing positions proves the editor can place an
 * element. Comparing the *resolved state at time t* proves the scrub shows what a learner
 * would see at that moment — and it is only checkable because the canvas renders at an
 * authoring time rather than fixed at zero (clarification Q1).
 *
 * The comparison is at the kernel, deliberately. `EditorCanvas` calls `resolve(slide, t)` with
 * the same two arguments the player passes and no third; asserting that the *function* gives
 * one answer per moment is what makes the rendered comparison meaningful rather than
 * circular. If the editor ever needed its own resolve, this is where it would show.
 */
const TIMES = [0, 1, 999, 1000, 2500, 4000, 7999, 8000]

describe('one resolution per moment', () => {
  it.each(TIMES)('is identical for editor and player at %ims', (t) => {
    const lesson = lessonWith(oneOfEachType())
    const slide = lesson.slides[0]!

    // Two calls stand in for the two consumers: nothing about the caller changes the answer,
    // because there is nowhere for a caller to say who it is.
    expect(resolve(slide, t)).toEqual(resolve(slide, t))

    // `resolve` does take an optional third argument — a ResolveContext of registries and a
    // theme. It is not a mode: it cannot change *which* elements come back, only how a
    // registered plugin resolves one. Passing an empty context proves that rather than
    // asserting an arity, which was this test's first, wrong formulation.
    expect(resolve(slide, t, {})).toEqual(resolve(slide, t))
  })

  it('changes with time, so the equality above is not vacuous', () => {
    const slide = lessonWith([
      element({ startMs: 0, endMs: 2000 }),
      element({ startMs: 4000, endMs: 8000 }),
    ]).slides[0]!

    const early = resolve(slide, 1000).elements.map((e) => e.id)
    const late = resolve(slide, 5000).elements.map((e) => e.id)

    expect(early).toHaveLength(1)
    expect(late).toHaveLength(1)
    expect(early).not.toEqual(late)
  })

  it('omits hidden elements at every moment, which is why the editor draws ghosts (BR-010)', () => {
    const slide = lessonWith([element({ hidden: true })]).slides[0]!
    for (const t of TIMES) expect(resolve(slide, t).elements).toHaveLength(0)
  })

  it('reports authored geometry, untouched by effects — the value a drag handle writes', () => {
    const slide = lessonWith([element({ x: 250, y: 125 })]).slides[0]!
    expect(resolve(slide, 0).elements[0]!.geometry).toMatchObject({ x: 250, y: 125 })
  })
})

describe('playback and seeking resolve to the same state (FR-043)', () => {
  /**
   * True by construction — `useFrameLoop` calls the same `resolveAt` a seek does — and
   * asserted anyway, because "true by construction" describes every parity bug before it
   * shipped. `FrameWriter`'s own header records what one looked like: "seeking to 500ms
   * produced different markup from stepping to 500ms".
   *
   * Feature 006 gives the editor a *second* path to visual state, and Constitution V is
   * NON-NEGOTIABLE precisely about that.
   */
  const lesson = () =>
    timelineLesson([
      element({ startMs: 0, endMs: 8000, payload: { text: 'always' } }),
      element({ startMs: 2000, endMs: 8000, payload: { text: 'later' } }),
    ])

  it('shows the same elements at a moment reached by playing as by seeking', async () => {
    const ports = fakePorts()
    const played = renderEditor(lesson(), { playback: true, ports })
    act(() => played.handle.playback.play())
    await runFrames(ports, 3000)
    act(() => played.handle.playback.pause())

    const seeked = renderEditor(lesson(), { playback: true, ports: fakePorts() })
    act(() => seeked.handle.playback.seek(3000))

    const text = (c: HTMLElement) => c.querySelector('.cs-editor')?.textContent ?? ''
    expect(text(played.container)).toBe(text(seeked.container))
  })

  it('reconciles to the same authoring time either way', async () => {
    const ports = fakePorts()
    const played = renderEditor(lesson(), { playback: true, ports })
    act(() => played.handle.playback.play())
    await runFrames(ports, 2500)
    act(() => played.handle.playback.pause())

    const seeked = renderEditor(lesson(), { playback: true, ports: fakePorts() })
    act(() => seeked.handle.playback.seek(2500))

    expect(played.handle.session.authoringTime).toBe(seeked.handle.session.authoringTime)
  })

  it('resolves identically to the player, which reads the same manifest', () => {
    // The editor is a second consumer of one engine, not a second engine. This is the claim
    // stated as an equality rather than as a design intention.
    const manifest = lesson()
    const { handle } = renderEditor(manifest, { playback: true, ports: fakePorts() })
    act(() => handle.playback.seek(4000))

    const fromEditor = resolve(handle.session.draft.slides[0]!, 4000)
    const fromManifest = resolve(manifest.slides[0]!, 4000)
    expect(fromEditor).toEqual(fromManifest)
  })
})
