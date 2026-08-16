import { act, render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LessonPlayerStatic } from '@cuestack/react'
import type { LessonManifest } from '@cuestack/schema'
import { EditorCanvas } from '../../src/canvas/EditorCanvas.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { hidden, lessonWith, notYet, oneOfEachType } from '../harness/corpus.js'

/**
 * T040 — FR-043: editor affordances live outside the element renderers.
 *
 * The check is a subtraction. Take the editing canvas, remove the overlay, and what is left
 * must be exactly what the player renders. Anything that survives the subtraction is an
 * affordance that leaked into the render layer.
 *
 * That is a stronger statement than "the overlay is a separate component". A selection
 * indicator drawn by adding a class to the element node would still be a separate component
 * and would still fail this.
 */
function editorSession(lesson: LessonManifest) {
  return renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource: countingIds() }),
  )
}

/** The render layer only: everything inside the stage that is not the overlay. */
function renderLayer(root: HTMLElement): string {
  const stage = root.querySelector('.cs-stage')!.cloneNode(true) as HTMLElement
  stage.querySelector('.cs-overlay')?.remove()
  return stage.innerHTML
}

describe('the overlay changes nothing beneath it', () => {
  it('leaves the render layer byte-identical to the player’s', () => {
    const lesson = lessonWith(oneOfEachType())
    const { result } = editorSession(lesson)

    const editor = render(<EditorCanvas session={result.current} />)
    const player = render(<LessonPlayerStatic lesson={lesson} />)

    expect(renderLayer(editor.container)).toBe(renderLayer(player.container))
  })

  it('leaves it unchanged when a selection is active', () => {
    const lesson = lessonWith(oneOfEachType())
    const { result } = editorSession(lesson)

    const before = renderLayer(render(<EditorCanvas session={result.current} />).container)
    act(() => result.current.select([lesson.slides[0]!.elements[0]!.id]))
    const after = renderLayer(render(<EditorCanvas session={result.current} />).container)

    expect(after).toBe(before)
  })

  it('leaves it unchanged when a ghost is present', () => {
    const lesson = lessonWith([...oneOfEachType(), notYet(), hidden()])
    const { result } = editorSession(lesson)

    const editor = render(<EditorCanvas session={result.current} />)
    const player = render(<LessonPlayerStatic lesson={lesson} />)

    expect(editor.container.querySelectorAll('[data-cs-ghost]').length).toBe(2)
    expect(renderLayer(editor.container)).toBe(renderLayer(player.container))
  })

  it('puts no ghost markup in a player render of the same manifest', () => {
    const lesson = lessonWith([notYet(), hidden()])
    const { container } = render(<LessonPlayerStatic lesson={lesson} />)

    expect(container.querySelector('[data-cs-ghost]')).toBeNull()
    expect(container.querySelector('.cs-overlay')).toBeNull()
    expect(container.querySelector('[data-cs-off-canvas]')).toBeNull()
  })

  it('keeps every affordance inside the overlay subtree', () => {
    const lesson = lessonWith([...oneOfEachType(), notYet(), hidden()])
    const { result } = editorSession(lesson)
    const { container } = render(<EditorCanvas session={result.current} />)

    for (const selector of ['[data-cs-ghost]', '[data-cs-off-canvas]']) {
      for (const node of container.querySelectorAll(selector)) {
        expect(node.closest('.cs-overlay')).not.toBeNull()
      }
    }
  })

  it('adds no editor prop to SlideView — the render layer takes what the player takes', () => {
    // Enforced by the compiler: SlideViewProps is closed, so an extra member is a build
    // error and gate 1 catches it. Asserted here only as the observable consequence — no
    // editor-specific attribute appears on any element node.
    const lesson = lessonWith(oneOfEachType())
    const { result } = editorSession(lesson)
    act(() => result.current.select([lesson.slides[0]!.elements[0]!.id]))
    const { container } = render(<EditorCanvas session={result.current} />)

    for (const node of container.querySelectorAll('.cs-element')) {
      const names = [...node.attributes].map((a) => a.name)
      expect(names).not.toContain('data-cs-selected')
      expect(names).not.toContain('aria-selected')
    }
  })
})
