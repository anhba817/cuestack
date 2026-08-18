import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderEditor } from '../harness/editor.js'
import { multiSlideLesson, unreachableLesson } from '../harness/preview.js'

/**
 * A lesson that cannot be finished is reported to the teacher, for the first time.
 *
 * The kernel has detected this since Wave 1 — `checkReachability`'s own comment states the
 * case: "without this, a learner staring at a stalled slide and a learner on a
 * deliberately-manual slide look identical." Wave 3 showed it to the learner. This shows it
 * to the author, which is the only person who can fix it.
 *
 * The preview **asks**; it does not detect. The wording is the kernel's, so there is one
 * message rather than two that will drift.
 */

afterEach(cleanup)

const preview = (container: HTMLElement): HTMLElement =>
  container.querySelector('.cs-preview') as HTMLElement

const report = (container: HTMLElement): HTMLElement | null =>
  preview(container).querySelector('[data-cs-preview-unreachable]')

describe('a dead end', () => {
  it('is reported, with the reason', () => {
    const { container } = renderEditor(unreachableLesson(), { preview: 'beginning' })
    const node = report(container)
    expect(node).not.toBeNull()
    expect(node!.textContent).toContain('cannot be finished')
  })

  it('is announced rather than only drawn', () => {
    // NFR-USA-004 and Constitution III: a problem conveyed by appearance alone is a problem
    // half the people who need it will not receive.
    const { container } = renderEditor(unreachableLesson(), { preview: 'beginning' })
    expect(report(container)!.getAttribute('role')).toBe('status')
  })
})

describe('a lesson that is fine', () => {
  it('says nothing at all', () => {
    // A panel that is usually empty teaches people to stop reading it. This is also the
    // control for the suite above: without it, a report rendered unconditionally would pass
    // every assertion there.
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    expect(report(container)).toBeNull()
  })
})
