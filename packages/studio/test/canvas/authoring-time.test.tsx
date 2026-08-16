import { act, render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditorCanvas } from '../../src/canvas/EditorCanvas.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith, noLonger, notYet } from '../harness/corpus.js'

/**
 * T034 — FR-010, FR-012: the canvas renders the slide at a time the teacher chooses.
 *
 * This is what makes the parity claim in `state.test.ts` checkable at all. A canvas fixed at
 * time zero could only ever be compared against the player's first frame; rendering at an
 * authoring time lets the whole slide be compared moment for moment (clarification Q1).
 */
function session(elements = [element()]) {
  const lesson = lessonWith(elements)
  return renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource: countingIds() }),
  )
}

/**
 * Elements in the *render layer* only.
 *
 * Scoped to `.cs-element` deliberately: the overlay labels its own affordances — hit targets,
 * selection boxes, ghosts — with the same `data-cs-element-id`, which is right for addressing
 * them and would double every count here if this selector were looser.
 */
const rendered = (root: HTMLElement): string[] =>
  [...root.querySelectorAll('.cs-element[data-cs-element-id]')].map(
    (n) => n.getAttribute('data-cs-element-id')!,
  )

describe('the authoring-time control', () => {
  it('defaults to the slide’s start', () => {
    const { result } = session()
    expect(result.current.authoringTime).toBe(0)
  })

  it('renders what the learner would see at that moment', () => {
    const { result } = session([element({ startMs: 0, endMs: 2000 }), notYet()])
    const early = render(<EditorCanvas session={result.current} />)
    expect(rendered(early.container)).toHaveLength(1)
    early.unmount()

    act(() => result.current.setAuthoringTime(5000))
    const later = render(<EditorCanvas session={result.current} />)
    // At 5000 the first element has ended and the second has begun: still one rendered,
    // but a different one.
    expect(rendered(later.container)).toHaveLength(1)
    expect(rendered(later.container)).not.toEqual(rendered(early.container))
  })

  it('clamps to the slide duration in both directions', () => {
    const { result } = session()
    const duration = result.current.draft.slides[0]!.durationMs

    act(() => result.current.setAuthoringTime(duration + 10_000))
    expect(result.current.authoringTime).toBe(duration)

    act(() => result.current.setAuthoringTime(-500))
    expect(result.current.authoringTime).toBe(0)
  })

  it('never appears empty — a moment with nothing visible still shows every element as a ghost', () => {
    const { result } = session([notYet(), noLonger()])
    act(() => result.current.setAuthoringTime(3000))
    const { container } = render(<EditorCanvas session={result.current} />)

    expect(rendered(container)).toHaveLength(0)
    expect(container.querySelectorAll('[data-cs-ghost]')).toHaveLength(2)
  })

  it('is session state and never reaches the manifest (FR-012, SC-007)', () => {
    const { result } = session()
    const before = JSON.stringify(result.current.draft)

    act(() => result.current.setAuthoringTime(4321))
    act(() => result.current.select([result.current.draft.slides[0]!.elements[0]!.id]))

    expect(JSON.stringify(result.current.draft)).toBe(before)
    expect(JSON.stringify(result.current.draft)).not.toContain('4321')
  })
})
