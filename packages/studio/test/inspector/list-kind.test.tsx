import { act, fireEvent, render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { validate } from '@cuestack/schema/validate'
import { Inspector } from '../../src/inspector/Inspector.js'
import { builtinElementEditors, createElementEditorRegistry } from '../../src/registry/editors.js'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { lessonWith, oneOfEachType } from '../harness/corpus.js'

/**
 * T059 — the field kind added for a question's options (research R-06).
 *
 * `question` is the seventh of seven MVP types, and its options are a repeating group that no
 * scalar kind describes. FR-019 says extend the contract rather than special-case the type,
 * and this suite is what shows the extension actually carries the type — otherwise `list`
 * would be a contract change nothing uses and the inspector would still need its branch.
 */
const editors = createElementEditorRegistry(builtinElementEditors)

function questionPanel() {
  const question = oneOfEachType().find((e) => e.type === 'question')!
  const lesson = lessonWith([question])
  const idSource = countingIds()
  const { result } = renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource }),
  )
  act(() => result.current.select([lesson.slides[0]!.elements[0]!.id]))
  const view = () =>
    render(
      <Inspector session={result.current} slide={result.current.draft.slides[0]!} editors={editors} />,
    )
  return { result, view }
}

const options = (result: { current: { draft: { slides: Array<{ elements: Array<{ payload: unknown }> }> } } }) =>
  (result.current.draft.slides[0]!.elements[0]!.payload as { options: Array<{ id: string; label: string }> })
    .options

describe('the list field kind', () => {
  it('renders a question’s options as a repeating group', () => {
    const { view } = questionPanel()
    const list = view().container.querySelector('[data-cs-kind="list"]')
    expect(list).not.toBeNull()
    expect(list!.querySelectorAll('[data-cs-list-item]')).toHaveLength(2)
  })

  it('labels the group and each item’s inputs', () => {
    const { view } = questionPanel()
    const list = view().container.querySelector('[data-cs-kind="list"]')!
    expect(list.querySelector('legend')!.textContent).toContain('Answer options')
    for (const input of list.querySelectorAll('input')) {
      expect(input.closest('label')).not.toBeNull()
    }
  })

  it('edits an item in place and leaves the others alone', () => {
    const { result, view } = questionPanel()
    const first = view().container.querySelectorAll<HTMLInputElement>('[data-cs-list-item="0"] input')[1]!

    act(() => void fireEvent.change(first, { target: { value: 'Edited' } }))

    expect(options(result)[0]!.label).toBe('Edited')
    expect(options(result)[1]!.label).toBe('Second')
  })

  it('adds an option', () => {
    const { result, view } = questionPanel()
    // Rendered outside `act`: a render *inside* act has not flushed when the container is
    // queried, so the button would not be found yet.
    const add = view().container.querySelector('[data-cs-list-add]')!
    act(() => void fireEvent.click(add))
    expect(options(result)).toHaveLength(3)
  })

  it('removes an option', () => {
    const { result, view } = questionPanel()
    const add = view().container.querySelector('[data-cs-list-add]')!
    act(() => void fireEvent.click(add))
    const remove = view().container.querySelector('[data-cs-list-remove="2"]')!
    act(() => void fireEvent.click(remove))
    expect(options(result)).toHaveLength(2)
  })

  /**
   * `minItems` is shown, not enforced here: the schema enforces it. The inspector's job is to
   * say why a removal will be refused *before* the teacher tries, rather than letting them
   * click and receive an error.
   */
  it('disables removal at the minimum the schema requires', () => {
    const { view } = questionPanel()
    const remove = view().container.querySelector<HTMLButtonElement>('[data-cs-list-remove="0"]')!
    expect(remove.disabled).toBe(true)
  })

  it('keeps the lesson valid across an add and an edit', () => {
    const { result, view } = questionPanel()
    const add = view().container.querySelector('[data-cs-list-add]')!
    act(() => void fireEvent.click(add))
    // Re-queried between edits: each commit re-renders, so nodes captured before the first
    // change are detached by the second.
    const idInput = view().container.querySelectorAll<HTMLInputElement>('[data-cs-list-item="2"] input')[0]!
    act(() => void fireEvent.change(idInput, { target: { value: 'c' } }))
    const labelInput = view().container.querySelectorAll<HTMLInputElement>('[data-cs-list-item="2"] input')[1]!
    act(() => void fireEvent.change(labelInput, { target: { value: 'Third' } }))

    expect(validate(result.current.draft).ok).toBe(true)
    expect(options(result)[2]).toEqual({ id: 'c', label: 'Third' })
  })
})
