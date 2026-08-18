import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderEditor, runFrames } from '../harness/editor.js'
import { multiSlideLesson } from '../harness/preview.js'

/**
 * In read-only, the preview stays.
 *
 * **The one place read-only widens rather than narrows.** Every other affordance in the
 * editor disappears in this mode, and the temptation is to treat that as the rule. It is not:
 * reviewing a lesson *is* reading it, and a reviewer who cannot preview cannot review. The
 * preview writes nothing, so there is nothing for read-only to forbid.
 */

afterEach(cleanup)

const preview = (container: HTMLElement): HTMLElement =>
  container.querySelector('.cs-preview') as HTMLElement

describe('a read-only session', () => {
  it('opens a preview and plays it', async () => {
    const { handle, container } = renderEditor(multiSlideLesson(), {
      mode: 'read-only',
      preview: 'beginning',
    })
    expect(preview(container)).not.toBeNull()
    const before = [...preview(container).querySelectorAll('[data-cs-element-id]')].length
    await runFrames(handle.previewPorts, 4400)
    expect(before).toBeGreaterThan(0)
  })

  it('offers the whole frame, not a reduced one', () => {
    // A preview that dropped the override or the presets in read-only would be a reviewer
    // being told they may look but not check.
    const { container } = renderEditor(multiSlideLesson(), {
      mode: 'read-only',
      preview: 'beginning',
    })
    for (const control of [
      '[data-cs-preview-close]',
      '[data-cs-preview-restart]',
      '[data-cs-preview-override]',
      '[data-cs-preview-preset-control]',
    ]) {
      expect(preview(container).querySelector(control), control).not.toBeNull()
    }
  })

  it('leaves the editor unmodifiable while it is open', () => {
    const lesson = multiSlideLesson()
    const before = JSON.stringify(lesson)
    const { handle, container } = renderEditor(lesson, { mode: 'read-only', preview: 'beginning' })

    const first = handle.session.draft.slides[0]!.elements[0]!
    const result = handle.session.apply({ kind: 'set-text', id: first.id, text: 'changed' })
    expect(result.ok).toBe(false)
    expect(JSON.stringify(handle.session.draft)).toBe(before)
    act(() => void preview(container))
  })
})
