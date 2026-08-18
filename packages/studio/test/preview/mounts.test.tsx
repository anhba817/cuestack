import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderEditor } from '../harness/editor.js'
import { multiSlideLesson } from '../harness/preview.js'

/**
 * The preview shows the lesson and none of the editor.
 *
 * **Asserted as a negative query, because the positive one is not checkable.** "Looks like
 * what a learner sees" has no assertion; "contains no overlay, no track, no playhead, no
 * inspector" does, and it is what FR-004 and BR-010 actually require. The affordances are
 * named individually rather than by a shared prefix so that adding a new one without adding
 * it here is a change this file notices.
 */

afterEach(cleanup)

/** Every editor-only marking, by the class the editor renders it with. */
const EDITOR_MARKINGS = [
  '.cs-overlay',
  '.cs-track',
  '.cs-timeline',
  '.cs-playhead',
  '.cs-sequence',
  '.cs-inspector',
  '.cs-ghost',
  '.cs-handle',
]

const previewTree = (container: HTMLElement): HTMLElement => {
  const node = container.querySelector('.cs-preview')
  if (!node) throw new Error('The preview did not render.')
  return node as HTMLElement
}

describe('the preview renders the lesson', () => {
  it('shows the slide’s content on a stage', () => {
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const preview = previewTree(container)
    expect(preview.querySelector('.cs-stage')).not.toBeNull()
    expect(preview.querySelectorAll('[data-cs-element-id]').length).toBeGreaterThan(0)
  })

  it('shows no editor affordance of any kind', () => {
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const preview = previewTree(container)
    for (const marking of EDITOR_MARKINGS) {
      expect(preview.querySelector(marking), `${marking} reached the preview`).toBeNull()
    }
  })
})

describe('the negative query is not vacuous', () => {
  it('finds those markings in the editor itself', () => {
    // Without this, the suite above would pass against an empty document, a preview that
    // failed to render, or a query that matched nothing anywhere. The canvas renders the
    // overlay, so at least one of the names has to be found somewhere for the other file's
    // absence assertions to mean anything.
    const { container } = renderEditor(multiSlideLesson(), { timeline: true })
    const found = EDITOR_MARKINGS.filter((m) => container.querySelector(m) !== null)
    expect(found.length).toBeGreaterThan(0)
    expect(found).toContain('.cs-overlay')
  })
})
