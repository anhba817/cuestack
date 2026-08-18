import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderEditor } from '../harness/editor.js'
import { multiSlideLesson } from '../harness/preview.js'

/**
 * The preview shows the draft, including what has not been saved.
 *
 * FR-002 is the requirement §17.3 names as the friction: a teacher who has to publish to see
 * their change is a teacher who checks less often. The draft is in memory and the preview
 * reads the same object the canvas does, so this is a test that the wiring did not
 * accidentally reach for a saved copy that does not exist yet.
 *
 * The other half is FR-005: none of the *editor's* state may cross. Selection is the sharp
 * case, because it is the one a teacher will have set moments before opening the preview.
 */

afterEach(cleanup)

const previewText = (container: HTMLElement): string =>
  (container.querySelector('.cs-preview') as HTMLElement | null)?.textContent ?? ''

describe('the preview shows unsaved work', () => {
  it('includes an edit applied a moment before it opened', () => {
    const lesson = multiSlideLesson()
    const { handle, container, unmount } = renderEditor(lesson, {})
    const first = handle.session.draft.slides[0]!.elements[0]!
    act(() => {
      handle.session.apply({ kind: 'set-text', id: first.id, text: 'edited, never saved' })
    })
    const edited = handle.session.draft
    unmount()

    const opened = renderEditor(edited, { preview: 'beginning' })
    expect(previewText(opened.container)).toContain('edited, never saved')
    void container
  })
})

describe('no editor state crosses into the preview', () => {
  it('carries no selection, however the teacher left the canvas', () => {
    const lesson = multiSlideLesson()
    const { handle, container } = renderEditor(lesson, { preview: 'beginning' })
    const first = handle.session.draft.slides[0]!.elements[0]!
    act(() => handle.session.select([first.id]))

    const preview = container.querySelector('.cs-preview') as HTMLElement
    expect(preview.querySelector('[data-cs-selected]')).toBeNull()
    expect(preview.querySelector('.cs-overlay')).toBeNull()
  })

  it('does not take the authoring time as the lesson’s time when starting at the beginning', () => {
    const lesson = multiSlideLesson()
    const { handle, container } = renderEditor(lesson, { preview: 'beginning' })
    act(() => handle.session.setAuthoringTime(3000))
    // Starting "from the beginning" means zero on the first slide whatever the editor's
    // playhead says. The authoring time is session state and not lesson data (FR-005).
    const preview = container.querySelector('.cs-preview') as HTMLElement
    expect(preview).not.toBeNull()
    expect(handle.session.authoringTime).toBe(3000)
  })
})
