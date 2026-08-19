import { act, fireEvent, render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditorCanvas } from '../../src/canvas/EditorCanvas.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * Deleting is immediate, and takes one press to undo.
 *
 * **Rewritten in feature 008, not deleted.** This file used to assert that a confirmation
 * appeared, and what it was really guarding was Constitution III's rule that a destructive
 * action must be undoable **or** confirmed. Feature 005 took the second because undo did not
 * exist, and said so in the component: the prompt was to be *removed* when ED-5 landed real
 * undo, "because a tool that both confirms and undoes every deletion is one that has stopped
 * trusting its own history."
 *
 * The requirement survives; only its mechanism changed. Deleting the tests along with the
 * component would have quietly dropped the requirement with them.
 */
function setup(elements = [element()], select = [0]) {
  const lesson = lessonWith(elements)
  const idSource = countingIds()
  const { result } = renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource }),
  )
  act(() => result.current.select(select.map((i) => lesson.slides[0]!.elements[i]!.id)))
  const { container } = render(<EditorCanvas session={result.current} />)
  return { result, container, lesson }
}

const press = (container: HTMLElement, selector: string): void => {
  act(() => void fireEvent.click(container.querySelector<HTMLButtonElement>(selector)!))
}

describe('deleting happens at once', () => {
  it('removes the element when the delete control is pressed', () => {
    const { result, container } = setup()
    press(container, '[data-cs-delete]')
    expect(result.current.draft.slides[0]!.elements).toHaveLength(0)
  })

  it('asks nothing first', () => {
    const { container } = setup()
    press(container, '[data-cs-delete]')
    // The whole point of FR-012: no prompt remains for an action one reversal takes back.
    expect(container.querySelector('[role="alertdialog"]')).toBeNull()
  })

  it('removes a whole selection in one action', () => {
    const { result, container } = setup([element(), element(), element()], [0, 1, 2])
    press(container, '[data-cs-delete]')
    expect(result.current.draft.slides[0]!.elements).toHaveLength(0)
  })
})

describe('and one undo brings it back', () => {
  it('restores a single element exactly', () => {
    const { result, container } = setup()
    const before = JSON.stringify(result.current.draft)
    press(container, '[data-cs-delete]')

    act(() => result.current.undo())
    expect(JSON.stringify(result.current.draft)).toBe(before)
  })

  it('restores a multiple deletion in one press, not three', () => {
    const { result, container } = setup([element(), element(), element()], [0, 1, 2])
    const before = JSON.stringify(result.current.draft)
    press(container, '[data-cs-delete]')

    act(() => result.current.undo())
    expect(JSON.stringify(result.current.draft)).toBe(before)
    expect(result.current.canUndo).toBe(false)
  })

  it('selects what came back, so the teacher can see what happened', () => {
    const { result, container, lesson } = setup()
    const id = lesson.slides[0]!.elements[0]!.id
    press(container, '[data-cs-delete]')
    act(() => result.current.undo())
    expect(result.current.selection).toEqual([id])
  })

  it('says so, for somebody who cannot see it happen', () => {
    // The announcement replaces what the prompt used to convey: that something destructive
    // occurred and there is a way back from it.
    const { container } = setup()
    press(container, '[data-cs-delete]')
    expect(container.querySelector('[data-cs-announcer]')?.textContent).toMatch(/undo to bring it back/i)
  })

  it('names the count for a multiple deletion', () => {
    const { container } = setup([element(), element(), element()], [0, 1, 2])
    press(container, '[data-cs-delete]')
    expect(container.querySelector('[data-cs-announcer]')?.textContent).toMatch(/3 elements deleted/i)
  })
})

describe('read-only still refuses', () => {
  it('deletes nothing and offers no delete control', () => {
    const lesson = lessonWith([element()])
    const { result } = renderHook(() =>
      useEditorSession({
        manifest: lesson,
        slideId: lesson.slides[0]!.id,
        idSource: countingIds(),
        mode: 'read-only',
      }),
    )
    act(() => result.current.select([lesson.slides[0]!.elements[0]!.id]))
    const { container } = render(<EditorCanvas session={result.current} />)

    expect(container.querySelector<HTMLButtonElement>('[data-cs-delete]')!.disabled).toBe(true)
    expect(result.current.draft.slides[0]!.elements).toHaveLength(1)
  })
})
