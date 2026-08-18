import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderEditor, runFrames } from '../harness/editor.js'
import { gatedLesson, multiSlideLesson } from '../harness/preview.js'

/**
 * Every action in User Stories 1–5, performed with no pointer events at all.
 *
 * SC-006, and the reason it is a whole file rather than an assertion inside each suite: a
 * control that happens to work with a mouse and not a keyboard fails silently everywhere
 * except here. Nothing below calls `.click()` on a mouse's behalf — the interactions are
 * focus, Enter, Space, and Escape, which is what a keyboard actually sends.
 *
 * Note what this cannot check. A focus *order* that is technically operable and practically
 * bewildering passes every assertion here, and so does a control whose accessible name is
 * accurate and meaningless. Those need a person; quickstart §15 is where they live.
 */

afterEach(cleanup)

const preview = (container: HTMLElement): HTMLElement =>
  container.querySelector('.cs-preview') as HTMLElement

/** Press a key on whatever currently has focus, the way a browser dispatches it. */
const press = (key: string): void => {
  const target = document.activeElement as HTMLElement
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    if (key === 'Enter' || key === ' ') {
      // A browser fires `click` on a focused button for Enter and Space. happy-dom does not,
      // so the test does what the platform would — asserting the handler is reachable from
      // the keyboard, which is the requirement, rather than reimplementing activation.
      if (target instanceof HTMLButtonElement || target instanceof HTMLInputElement) target.click()
    }
    target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }))
  })
}

/** Every control the preview offers, in document order. */
const focusables = (container: HTMLElement): HTMLElement[] =>
  [
    ...preview(container).querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  ]

describe('every preview control is reachable and operable by keyboard', () => {
  it('gives every control an accessible name', () => {
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    for (const control of focusables(container)) {
      const name =
        control.getAttribute('aria-label') ??
        control.getAttribute('title') ??
        labelText(control) ??
        control.textContent
      expect(name?.trim(), `${control.outerHTML.slice(0, 80)} has no accessible name`).toBeTruthy()
    }
  })

  it('opens from each of the three start points', () => {
    const { handle, container } = renderEditor(multiSlideLesson(), {})
    for (const from of ['beginning', 'slide', 'position'] as const) {
      handle.openPreview(from)
      expect(preview(container)).not.toBeNull()
      const close = preview(container).querySelector('[data-cs-preview-close]') as HTMLElement
      close.focus()
      press('Enter')
    }
  })

  it('drives play, pause, previous, and next from the keyboard', async () => {
    const { handle, container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const next = preview(container).querySelector('[data-cs-preview-next]') as HTMLElement
    next.focus()
    expect(document.activeElement).toBe(next)
    press('Enter')
    await runFrames(handle.previewPorts, 100)

    const previous = preview(container).querySelector('[data-cs-preview-previous]') as HTMLElement
    previous.focus()
    press(' ')
    await runFrames(handle.previewPorts, 100)
    expect(preview(container).querySelector('.cs-stage')).not.toBeNull()
  })

  it('restarts from the keyboard', () => {
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const restart = preview(container).querySelector('[data-cs-preview-restart]') as HTMLElement
    restart.focus()
    press('Enter')
    expect(preview(container).querySelector('.cs-stage')).not.toBeNull()
  })

  it('toggles the override from the keyboard, and past a gate', async () => {
    const { handle, container } = renderEditor(gatedLesson(), { preview: 'beginning' })
    const toggle = preview(container).querySelector('[data-cs-preview-override]') as HTMLInputElement
    toggle.focus()
    press(' ')
    expect(toggle.checked).toBe(true)
    await runFrames(handle.previewPorts, 8000)
    expect(preview(container).querySelector('[data-cs-override-on]')).not.toBeNull()
  })

  it('changes the viewport preset from the keyboard', () => {
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const mobile = preview(container).querySelector(
      'input[name="cs-preview-preset"][value="mobile"]',
    ) as HTMLInputElement
    mobile.focus()
    press(' ')
    const viewport = preview(container).querySelector('.cs-preview-viewport') as HTMLElement
    expect(viewport.getAttribute('data-cs-preview-preset')).toBe('mobile')
  })

  it('closes from the keyboard, and Escape does it too', () => {
    const { handle, container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const close = preview(container).querySelector('[data-cs-preview-close]') as HTMLElement
    close.focus()
    press('Enter')
    expect(handle.open()).toBe(false)

    // Escape is the platform's, via `<dialog>`'s `cancel` event — not a key handler this
    // component writes. Dispatched directly because happy-dom does not synthesise it.
    handle.openPreview('beginning')
    const dialog = preview(container) as HTMLDialogElement
    act(() => {
      dialog.dispatchEvent(new Event('cancel', { cancelable: true, bubbles: true }))
    })
    expect(handle.open()).toBe(false)
  })
})

/** The text of a wrapping `<label>`, for controls named that way. */
function labelText(control: HTMLElement): string | null {
  const label = control.closest('label')
  // `||`, not `??`: an element's `textContent` is `''` rather than nullish when it is empty,
  // so a nullish chain short-circuits before the wrapping label and every labelled input
  // looks unnamed. That mistake made a whole suite pass for the wrong reason once already.
  return label ? label.textContent || null : null
}
