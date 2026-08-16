import { act, fireEvent, render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditorCanvas } from '../../src/canvas/EditorCanvas.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * T081 — FR-033, FR-039, SC-013.
 *
 * The bar Constitution III sets is "undoable **or** confirmed", and this feature takes the
 * second. Recorded as temporary throughout: ED-5 brings real undo and should *remove* this
 * prompt rather than keep it alongside, because a tool that both confirms and undoes every
 * deletion is one that has stopped trusting its own history.
 */
function setup(elements = [element()], select = [0]) {
  const lesson = lessonWith(elements)
  const idSource = countingIds()
  const { result } = renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource }),
  )
  act(() => result.current.select(select.map((i) => lesson.slides[0]!.elements[i]!.id)))
  /**
   * Rendered once, then reused.
   *
   * The confirmation is `Overlay`'s own state, not the session's — a prompt nobody answers
   * must not touch the draft. So re-rendering between assertions would mount a fresh Overlay
   * with the prompt closed again, and every assertion after the click would look at a
   * component that never saw it.
   */
  const { container } = render(<EditorCanvas session={result.current} />)
  return { result, container }
}

describe('deleting asks first', () => {
  it('removes nothing when the delete control is pressed', () => {
    const { result, container } = setup()
    const trigger = container.querySelector<HTMLButtonElement>('[data-cs-delete]')!

    act(() => void fireEvent.click(trigger))

    expect(result.current.draft.slides[0]!.elements).toHaveLength(1)
  })

  it('opens a confirmation that names what will be removed', () => {
    const { container } = setup()
    const trigger = container.querySelector<HTMLButtonElement>('[data-cs-delete]')!
    act(() => void fireEvent.click(trigger))

    const dialog = container.querySelector('[data-cs-confirm="delete"]')
    expect(dialog).not.toBeNull()
    expect(dialog!.textContent).toContain('Delete the text element?')
  })

  it('removes the element once confirmed', () => {
    const { result, container } = setup()
    act(() => void fireEvent.click(container.querySelector<HTMLButtonElement>('[data-cs-delete]')!))
    const confirm = container.querySelector<HTMLButtonElement>('[data-cs-confirm-delete]')!

    act(() => void fireEvent.click(confirm))

    expect(result.current.draft.slides[0]!.elements).toHaveLength(0)
  })

  it('keeps the element when cancelled, and closes the prompt', () => {
    const { result, container } = setup()
    act(() => void fireEvent.click(container.querySelector<HTMLButtonElement>('[data-cs-delete]')!))
    const cancel = container.querySelector<HTMLButtonElement>('[data-cs-confirm-cancel]')!

    act(() => void fireEvent.click(cancel))

    expect(result.current.draft.slides[0]!.elements).toHaveLength(1)
    expect(container.querySelector('[data-cs-confirm="delete"]')).toBeNull()
  })

  /**
   * One prompt for the whole selection.
   *
   * Seven prompts to delete seven things is how a teacher learns to click through prompts
   * without reading them, which costs more safety than it buys.
   */
  it('asks once for a multiple selection, and states how many', () => {
    const { result, container } = setup([element(), element(), element()], [0, 1, 2])
    act(() => void fireEvent.click(container.querySelector<HTMLButtonElement>('[data-cs-delete]')!))

    const dialogs = container.querySelectorAll('[data-cs-confirm="delete"]')
    expect(dialogs).toHaveLength(1)
    expect(dialogs[0]!.textContent).toContain('Delete 3 elements?')

    act(() => void fireEvent.click(container.querySelector<HTMLButtonElement>('[data-cs-confirm-delete]')!))
    expect(result.current.draft.slides[0]!.elements).toHaveLength(0)
  })

  it('is announced as a modal alert, so it is not missed', () => {
    const { container } = setup()
    act(() => void fireEvent.click(container.querySelector<HTMLButtonElement>('[data-cs-delete]')!))
    const dialog = container.querySelector('[data-cs-confirm="delete"]')!

    expect(dialog.getAttribute('role')).toBe('alertdialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toContain('Delete')
  })

  it('takes focus when it opens (FR-039)', () => {
    const { container } = setup()
    act(() => void fireEvent.click(container.querySelector<HTMLButtonElement>('[data-cs-delete]')!))

    expect(document.activeElement?.getAttribute('data-cs-confirm-delete')).toBe('')
  })

  it('dismisses on Escape without removing anything', () => {
    const { result, container } = setup()
    act(() => void fireEvent.click(container.querySelector<HTMLButtonElement>('[data-cs-delete]')!))
    const dialog = container.querySelector('[data-cs-confirm="delete"]')!

    act(() => void fireEvent.keyDown(dialog, { key: 'Escape' }))

    expect(result.current.draft.slides[0]!.elements).toHaveLength(1)
    expect(container.querySelector('[data-cs-confirm="delete"]')).toBeNull()
  })

  it('says plainly that this cannot be undone yet', () => {
    const { container } = setup()
    act(() => void fireEvent.click(container.querySelector<HTMLButtonElement>('[data-cs-delete]')!))
    expect(container.querySelector('[data-cs-confirm="delete"]')!.textContent).toContain(
      'cannot be undone yet',
    )
  })

  it('is the only route to a delete — nothing else removes an element', () => {
    const { result, container } = setup()
    // No control outside the confirmation applies a delete edit directly.
    const direct = [...container.querySelectorAll('button')].filter(
      (b) => b.hasAttribute('data-cs-delete') || b.hasAttribute('data-cs-confirm-delete'),
    )
    expect(direct).toHaveLength(1)
    expect(result.current.draft.slides[0]!.elements).toHaveLength(1)
  })
})
