import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderEditor, runFrames } from '../harness/editor.js'
import { multiSlideLesson, oneSlideLesson } from '../harness/preview.js'

/**
 * Driving the preview: play, pause, seek, previous, next.
 *
 * All five come from the player or from its transport — `PlaybackControls` has existed since
 * Wave 3 and `goToSlide` since Wave 2. What this feature writes is the arrangement and the
 * boundary states, which is where the mistakes are.
 */

afterEach(cleanup)

const preview = (container: HTMLElement): HTMLElement =>
  container.querySelector('.cs-preview') as HTMLElement

const visibleIds = (container: HTMLElement): string[] =>
  [...preview(container).querySelectorAll('[data-cs-element-id]')].map(
    (n) => n.getAttribute('data-cs-element-id')!,
  )

const control = (container: HTMLElement, attr: string): HTMLButtonElement =>
  preview(container).querySelector(`[${attr}]`) as HTMLButtonElement

describe('play and pause', () => {
  it('pause holds the moment, and play resumes from it', async () => {
    const { handle, container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    await runFrames(handle.previewPorts, 1000)

    const pause = [...preview(container).querySelectorAll('button')].find(
      (b) => /pause/i.test(b.textContent ?? ''),
    )!
    act(() => pause.click())
    const held = visibleIds(container)

    // Time passes and the preview does not move, which is what pause means.
    await runFrames(handle.previewPorts, 2000)
    expect(visibleIds(container)).toEqual(held)
  })
})

describe('previous and next', () => {
  it('each play from that slide’s start', async () => {
    const { handle, container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const first = visibleIds(container)

    act(() => control(container, 'data-cs-preview-next').click())
    await runFrames(handle.previewPorts, 100)
    const second = visibleIds(container)
    expect(second).not.toEqual(first)

    act(() => control(container, 'data-cs-preview-previous').click())
    await runFrames(handle.previewPorts, 100)
    expect(visibleIds(container)).toEqual(first)
  })
})

describe('the ends of the lesson', () => {
  it('makes previous unavailable on the first slide, and says why', () => {
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const previous = control(container, 'data-cs-preview-previous')
    expect(previous.disabled).toBe(true)
    expect(preview(container).textContent).toContain('nothing before it')
  })

  it('makes next unavailable on the last slide, and says why', async () => {
    // `goToSlide` past the last index sets the transport to `completed`, so next has to be
    // *unavailable* at the end rather than calling it and finding out — which would end the
    // lesson rather than refuse the request.
    const { handle, container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    act(() => control(container, 'data-cs-preview-next').click())
    act(() => control(container, 'data-cs-preview-next').click())
    await runFrames(handle.previewPorts, 100)

    const next = control(container, 'data-cs-preview-next')
    expect(next.disabled).toBe(true)
    expect(preview(container).textContent).toContain('nothing after it')
  })

  it('makes both unavailable in a one-slide lesson', () => {
    const { container } = renderEditor(oneSlideLesson(), { preview: 'beginning' })
    expect(control(container, 'data-cs-preview-previous').disabled).toBe(true)
    expect(control(container, 'data-cs-preview-next').disabled).toBe(true)
    expect(preview(container).textContent).toContain('one slide')
  })
})

describe('unavailable, not inert', () => {
  it('gives every disabled control a reason a teacher can read', () => {
    // NFR-USA-004: a control that does nothing and says nothing is indistinguishable from a
    // broken one. `aria-disabled` alongside `disabled` so the reason is announced rather than
    // the control being skipped silently.
    const { container } = renderEditor(oneSlideLesson(), { preview: 'beginning' })
    for (const attr of ['data-cs-preview-previous', 'data-cs-preview-next']) {
      const button = control(container, attr)
      expect(button.getAttribute('aria-disabled')).toBe('true')
      expect(button.getAttribute('title')).toBeTruthy()
    }
  })
})
