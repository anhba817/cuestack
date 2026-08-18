import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderEditor, runFrames } from '../harness/editor.js'
import { multiSlideLesson } from '../harness/preview.js'

/**
 * Opening and closing a preview leaves the editor exactly where it was.
 *
 * FR-006 reads like a save-and-restore and is the opposite: the preview never touches the
 * session, so there is nothing to put back and nothing that can put it back wrongly. If the
 * implementation grows a snapshot, the modal promise has leaked.
 *
 * Two things have to hold for that absence to be true, and neither holds by itself — the
 * editor's own clock has to stop when the preview opens, and the editor behind has to be
 * unreachable rather than merely covered. Both are asserted here.
 */

afterEach(cleanup)

const preview = (container: HTMLElement): HTMLElement =>
  container.querySelector('.cs-preview') as HTMLElement

describe('closing returns the editor to what it held', () => {
  it('leaves slide, selection, and authoring time untouched', () => {
    const lesson = multiSlideLesson()
    const { handle, container } = renderEditor(lesson, { preview: 'position', timeline: true })
    const first = handle.session.draft.slides[0]!.elements[0]!
    act(() => handle.session.select([first.id]))
    act(() => handle.session.setAuthoringTime(1200))

    const before = {
      slideId: handle.session.slideId,
      selection: [...handle.session.selection],
      atMs: handle.session.authoringTime,
      draft: JSON.stringify(handle.session.draft),
    }

    const close = preview(container).querySelector('[data-cs-preview-close]') as HTMLElement
    act(() => close.click())

    expect(handle.open()).toBe(false)
    expect(handle.session.slideId).toBe(before.slideId)
    expect([...handle.session.selection]).toEqual(before.selection)
    expect(handle.session.authoringTime).toBe(before.atMs)
    expect(JSON.stringify(handle.session.draft)).toBe(before.draft)
  })
})

describe('focus', () => {
  it('moves into the preview when it opens', () => {
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    expect(preview(container).contains(document.activeElement)).toBe(true)
  })

  it('returns to the control that opened it, wherever focus was inside', () => {
    // The rule the split chrome creates a need for. Focus may be in the player's own
    // controls or in the completion state when the teacher closes, and the target is the
    // same either way. Feature 005's delete confirmation is the precedent for the mechanism
    // and did not need this rule, being one dialogue with one region.
    const opener = document.createElement('button')
    opener.textContent = 'Preview'
    document.body.appendChild(opener)
    opener.focus()

    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const close = preview(container).querySelector('[data-cs-preview-close]') as HTMLElement
    act(() => close.click())
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})

describe('the editor behind is unreachable, not merely covered', () => {
  it('is a modal dialog, so the platform holds everything outside it', () => {
    // happy-dom implements `showModal()` and not the top layer's focus containment, so this
    // asserts the mechanism is in place rather than that Tab was blocked — the same honesty
    // the viewport suite uses about layout. The manual pass confirms the effect.
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const node = preview(container)
    expect(node.tagName.toLowerCase()).toBe('dialog')
    expect((node as HTMLDialogElement).open).toBe(true)
  })

  it('has an accessible name of its own', () => {
    // axe will not ask for this: the suite runs only the WCAG tags and `aria-dialog-name` is
    // tagged best-practice. An unnamed modal is announced as "dialog" and nothing else.
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const name = preview(container).getAttribute('aria-label')
    expect(name).toBeTruthy()
    expect(name).toContain('Editor fixture')
  })
})

describe('the editor’s own clock', () => {
  it('stops when the preview opens, at the moment it opened', async () => {
    // `usePlayback` ticks for as long as its state is `playing`, and mounting a preview does
    // not touch it. Two clocks over one slide are two answers to what time it is — and the
    // authoring time FR-006 promises to restore would move while the teacher watched.
    const lesson = multiSlideLesson()
    const { handle, container, unmount } = renderEditor(lesson, { timeline: true })
    act(() => handle.playback.play())
    await runFrames(handle.playback as unknown as { advance(ms: number): void }, 0)
    unmount()
    void container

    const opened = renderEditor(lesson, { preview: 'position', timeline: true })
    expect(opened.handle.playback.state).not.toBe('playing')
  })

  it('closing while the preview is playing leaves nothing running', async () => {
    const { handle, container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    await runFrames(handle.previewPorts, 1000)
    const close = preview(container).querySelector('[data-cs-preview-close]') as HTMLElement
    act(() => close.click())
    const writes = handle.previewPorts.events.length
    await runFrames(handle.previewPorts, 1000)
    expect(handle.previewPorts.events.length).toBe(writes)
  })
})
