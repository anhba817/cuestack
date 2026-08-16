import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * T015 — the session invariants from data-model.md §2.
 *
 * Session state is everything the teacher is currently doing and nothing a learner ever
 * receives. The invariants here are what keep that line honest: a selection that outlives
 * its element, or an authoring time past the end of a slide, are the two ways this state
 * starts lying about the draft.
 */
describe('useEditorSession', () => {
  const setup = (elements = [element()]) => {
    const lesson = lessonWith(elements)
    const slideId = lesson.slides[0]!.id
    return renderHook(() =>
      useEditorSession({ manifest: lesson, slideId, idSource: countingIds() }),
    )
  }

  it('starts with nothing selected, which means the slide is selected', () => {
    const { result } = setup()
    expect(result.current.selection).toEqual([])
  })

  it('holds only ids present on the slide', () => {
    const { result } = setup()
    const id = result.current.draft.slides[0]!.elements[0]!.id

    act(() => result.current.select([id, 'not-on-this-slide']))
    expect(result.current.selection).toEqual([id])
  })

  it('defaults the authoring time to the slide start', () => {
    const { result } = setup()
    expect(result.current.authoringTime).toBe(0)
  })

  it('clamps the authoring time to the slide duration', () => {
    const { result } = setup()
    const duration = result.current.draft.slides[0]!.durationMs

    act(() => result.current.setAuthoringTime(duration + 5000))
    expect(result.current.authoringTime).toBe(duration)

    act(() => result.current.setAuthoringTime(-1))
    expect(result.current.authoringTime).toBe(0)
  })

  it('keeps the authoring time per slide rather than globally', () => {
    const lesson = lessonWith([element()])
    const extra = { ...lesson.slides[0]!, id: 'slide-two' }
    const twoSlides = { ...lesson, slides: [lesson.slides[0]!, extra] }
    const { result } = renderHook(() =>
      useEditorSession({ manifest: twoSlides, slideId: twoSlides.slides[0]!.id, idSource: countingIds() }),
    )

    act(() => result.current.setAuthoringTime(3000))
    act(() => result.current.goToSlide('slide-two'))
    expect(result.current.authoringTime).toBe(0)

    act(() => result.current.goToSlide(twoSlides.slides[0]!.id))
    expect(result.current.authoringTime).toBe(3000)
  })

  it('commits pending text before the selection changes, and never onto the new element', () => {
    const { result } = setup([element({ payload: { text: 'before' } }), element()])
    const [first, second] = result.current.draft.slides[0]!.elements

    act(() => result.current.select([first!.id]))
    act(() => result.current.beginTextEdit(first!.id))
    act(() => result.current.setPendingText('after'))
    act(() => result.current.select([second!.id]))

    const elements = result.current.draft.slides[0]!.elements
    expect(result.current.textEditing).toBeNull()
    expect((elements[0]!.payload as { text: string }).text).toBe('after')
    expect((elements[1]!.payload as { text: string }).text).toBe('content')
  })

  it('starts with an empty clipboard, which is session state and never serialized', () => {
    const { result } = setup()
    expect(result.current.clipboard).toEqual([])
  })
})
