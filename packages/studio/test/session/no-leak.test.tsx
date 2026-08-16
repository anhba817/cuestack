import { act, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderEditor } from '../harness/editor.js'
import { element, hidden, lessonWith, notYet } from '../harness/corpus.js'

/**
 * T104 — SC-007, FR-044: editor state never reaches the manifest.
 *
 * The line this measures is the feature's central invariant. `draft` is authored data and the
 * single source of truth; selection, hover, authoring time, text-edit mode, and the clipboard
 * are things the teacher is currently doing and nothing a learner ever receives.
 *
 * Checked by byte comparison rather than by inspecting fields, because the failure mode is a
 * field nobody thought to look for.
 */
function setup() {
  const { handle, container } = renderEditor(
    lessonWith([element(), element({ x: 700 }), notYet(), hidden()]),
  )
  return { s: handle, container }
}

describe('a session of pure navigation leaves the manifest byte-identical', () => {
  it('after selecting, traversing, scrubbing, and copying', () => {
    const { s, container } = setup()
    const before = JSON.stringify(s.session.draft)
    const ids = s.session.draft.slides[0]!.elements.map((e) => e.id)

    act(() => s.session.select([ids[0]!]))
    act(() => s.session.select([ids[0]!, ids[1]!]))
    act(() => s.session.setAuthoringTime(4321))
    act(() => s.session.copy(ids))
    act(() => s.session.select([]))
    act(() =>
      void fireEvent.keyDown(container.querySelector('[data-cs-overlay]')!, { key: 'Tab' }),
    )

    expect(JSON.stringify(s.session.draft)).toBe(before)
  })

  it('holds none of the session’s vocabulary in the serialized lesson', () => {
    const { s } = setup()
    act(() => s.session.select(s.session.draft.slides[0]!.elements.map((e) => e.id)))
    act(() => s.session.setAuthoringTime(1234))

    const serialized = JSON.stringify(s.session.draft)
    for (const leak of ['selection', 'authoringTime', 'clipboard', 'textEditing', 'hover', '1234']) {
      expect(serialized).not.toContain(leak)
    }
  })

  it('keeps the authoring time out even after it has been moved and read back', () => {
    const { s } = setup()
    act(() => s.session.setAuthoringTime(2500))
    expect(s.session.authoringTime).toBe(2500)
    expect(JSON.stringify(s.session.draft)).not.toContain('2500')
  })

  it('keeps the clipboard out, even holding a copy of a real element', () => {
    const { s } = setup()
    const before = JSON.stringify(s.session.draft)
    act(() => s.session.copy([s.session.draft.slides[0]!.elements[0]!.id]))

    expect(s.session.clipboard).toHaveLength(1)
    expect(JSON.stringify(s.session.draft)).toBe(before)
  })

  it('changes the manifest only when an edit is applied', () => {
    const { s } = setup()
    const before = JSON.stringify(s.session.draft)

    act(() => s.session.select([s.session.draft.slides[0]!.elements[0]!.id]))
    expect(JSON.stringify(s.session.draft)).toBe(before)

    // And the control: an actual edit does change it, so the comparison above is not vacuous.
    act(() => void s.session.apply({ kind: 'add-element', type: 'text' }))
    expect(JSON.stringify(s.session.draft)).not.toBe(before)
  })
})
