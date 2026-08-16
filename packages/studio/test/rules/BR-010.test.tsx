import { act, render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { resolve } from '@cuestack/core'
import { LessonPlayerStatic } from '@cuestack/react'
import { EditorCanvas } from '../../src/canvas/EditorCanvas.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { element, hidden, lessonWith } from '../harness/corpus.js'

/**
 * BR-010 — elements hidden in the editor remain part of the draft but do not render in
 * preview or playback.
 *
 * **The editor half of the rule.** `packages/core/test/rules/BR-010.test.ts` has covered the
 * kernel's half since Wave 1: `resolve()` omits a hidden element. What had no coverage, and
 * what this feature adds, is the other clause — "remain part of the draft" — which only means
 * something once something can hide an element and has to keep showing it to the author.
 *
 * A rule test named for its ID, so compliance stays greppable (Constitution II).
 */
function session(elements = [hidden()]) {
  const lesson = lessonWith(elements)
  const idSource = countingIds()
  return renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource }),
  )
}

describe('BR-010: a hidden element stays in the draft and out of playback', () => {
  it('remains in the draft', () => {
    const { result } = session()
    expect(result.current.draft.slides[0]!.elements).toHaveLength(1)
    expect(result.current.draft.slides[0]!.elements[0]!.hidden).toBe(true)
  })

  it('is absent from resolve(), and therefore from preview and playback', () => {
    const { result } = session()
    expect(resolve(result.current.draft.slides[0]!, 0).elements).toHaveLength(0)
  })

  it('renders nothing in the player', () => {
    const { result } = session()
    const { container } = render(<LessonPlayerStatic lesson={result.current.draft} />)
    expect(container.querySelectorAll('.cs-element')).toHaveLength(0)
  })

  it('stays visible-as-hidden on the editing canvas, and says so in words', () => {
    const { result } = session()
    const { container } = render(<EditorCanvas session={result.current} />)

    const ghost = container.querySelector('[data-cs-ghost="hidden"]')
    expect(ghost).not.toBeNull()
    expect(ghost!.textContent).toContain('hidden from learners')
    // Still not rendered as an element: the affordance is not the thing.
    expect(container.querySelectorAll('.cs-element')).toHaveLength(0)
  })

  it('is selectable on the canvas', () => {
    const { result } = session()
    const { container } = render(<EditorCanvas session={result.current} />)
    const ghost = container.querySelector<HTMLButtonElement>('[data-cs-ghost="hidden"]')!

    act(() => ghost.click())
    expect(result.current.selection).toEqual([result.current.draft.slides[0]!.elements[0]!.id])
  })

  it('can be unhidden, which is the round trip the rule implies', () => {
    const { result } = session()
    const id = result.current.draft.slides[0]!.elements[0]!.id

    act(() => void result.current.apply({ kind: 'set-flag', ids: [id], flag: 'hidden', value: false }))

    expect(result.current.draft.slides[0]!.elements[0]!.hidden).toBe(false)
    expect(resolve(result.current.draft.slides[0]!, 0).elements).toHaveLength(1)
  })

  it('hides an element that was visible, without removing it', () => {
    const { result } = session([element()])
    const id = result.current.draft.slides[0]!.elements[0]!.id

    act(() => void result.current.apply({ kind: 'set-flag', ids: [id], flag: 'hidden', value: true }))

    expect(result.current.draft.slides[0]!.elements).toHaveLength(1)
    expect(resolve(result.current.draft.slides[0]!, 0).elements).toHaveLength(0)
  })
})
