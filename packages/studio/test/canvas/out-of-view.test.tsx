import { act, render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditorCanvas } from '../../src/canvas/EditorCanvas.js'
import { ghostReason } from '../../src/canvas/Ghost.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { element, hidden, lessonWith, noLonger, notYet } from '../harness/corpus.js'

/**
 * T035 — FR-011, FR-031, and Edge Case #1, in one suite.
 *
 * One category, three reasons. Whether an element is out of its time window, hidden from
 * learners, or positioned off the canvas, the editor's job is the same: show that it exists
 * and let it be selected. Splitting these across three files put the same assertion in three
 * places, which the third analysis pass found and this consolidation fixes.
 */
function session(elements = [element()]) {
  const lesson = lessonWith(elements)
  return renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource: countingIds() }),
  )
}

describe('ghostReason', () => {
  it('says “not yet” before an element’s window', () => {
    expect(ghostReason(notYet(), 0)).toBe('not-yet')
  })

  it('says “no longer” after it', () => {
    expect(ghostReason(noLonger(), 5000)).toBe('no-longer')
  })

  it('says “hidden” regardless of the clock, because hiding is a decision', () => {
    expect(ghostReason(hidden(), 0)).toBe('hidden')
    expect(ghostReason(element({ hidden: true, startMs: 4000, endMs: 8000 }), 0)).toBe('hidden')
  })
})

describe('ghosts on the canvas', () => {
  it('draws one for an element outside its window, at either end', () => {
    const { result } = session([notYet(), noLonger()])
    act(() => result.current.setAuthoringTime(3000))
    const { container } = render(<EditorCanvas session={result.current} />)

    const ghosts = [...container.querySelectorAll('[data-cs-ghost]')]
    expect(ghosts.map((g) => g.getAttribute('data-cs-ghost')).sort()).toEqual([
      'no-longer',
      'not-yet',
    ])
  })

  it('draws one for a hidden element, which is in the draft but never rendered (BR-010)', () => {
    const { result } = session([hidden()])
    const { container } = render(<EditorCanvas session={result.current} />)

    expect(container.querySelectorAll('[data-cs-ghost="hidden"]')).toHaveLength(1)
    expect(result.current.draft.slides[0]!.elements).toHaveLength(1)
  })

  it('says why in words, not by appearance alone (NFR-ACC-005)', () => {
    const { result } = session([hidden()])
    const { container } = render(<EditorCanvas session={result.current} />)
    expect(container.textContent).toContain('hidden from learners')
  })

  /**
   * The distinction that keeps this honest. A ghost is an affordance: it draws an outline and
   * a label at the authored geometry and never invokes the element's renderer. Resolving the
   * element at a time inside its own window would show a frame that occurs at no single
   * moment of the lesson (research R-02).
   */
  it('invokes no element renderer — it is an affordance, not a render', () => {
    const { result } = session([hidden()])
    const { container } = render(<EditorCanvas session={result.current} />)

    expect(container.querySelector('.cs-element-text')).toBeNull()
    expect(container.querySelector('[data-cs-ghost]')).not.toBeNull()
  })

  it('is selectable, so an element can be authored whenever it is', () => {
    const { result } = session([notYet()])
    const { container } = render(<EditorCanvas session={result.current} />)
    const ghost = container.querySelector<HTMLButtonElement>('[data-cs-ghost]')!

    act(() => ghost.click())
    expect(result.current.selection).toEqual([result.current.draft.slides[0]!.elements[0]!.id])
  })

  it('is focusable, so it is reachable without a pointer', () => {
    const { result } = session([notYet()])
    const { container } = render(<EditorCanvas session={result.current} />)
    const ghost = container.querySelector<HTMLElement>('[data-cs-ghost]')!

    ghost.focus()
    expect(document.activeElement).toBe(ghost)
  })
})

describe('elements outside the canvas bounds', () => {
  it('marks an element that has left the canvas, without moving it back', () => {
    const { result } = session([element({ x: -800, y: 100 })])
    const { container } = render(<EditorCanvas session={result.current} />)

    expect(container.querySelector('[data-cs-off-canvas]')).not.toBeNull()
    // Permitted, not prevented: an element may legitimately start off-stage and slide in.
    expect(result.current.draft.slides[0]!.elements[0]!.x).toBe(-800)
  })

  it('marks one that only partly overhangs', () => {
    const { result } = session([element({ x: 1500, width: 400 })])
    const { container } = render(<EditorCanvas session={result.current} />)
    expect(container.querySelector('[data-cs-off-canvas]')).not.toBeNull()
  })

  it('leaves an element fully on the canvas unmarked', () => {
    const { result } = session([element({ x: 100, y: 100, width: 200, height: 200 })])
    const { container } = render(<EditorCanvas session={result.current} />)
    expect(container.querySelector('[data-cs-off-canvas]')).toBeNull()
  })
})
