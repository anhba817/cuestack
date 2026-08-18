import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderEditor } from '../harness/editor.js'
import { multiSlideLesson } from '../harness/preview.js'
import { PREVIEW_PRESETS, floorsFor } from '../../src/preview/constants.js'

/**
 * Desktop, tablet, mobile — a **size**, not a proportion.
 *
 * `.cs-stage` declares `aspect-ratio` from the lesson's canvas and every dimension beneath it
 * is in container query units against that same canvas, so a preset cannot change the
 * lesson's shape and a narrower preview is otherwise *the same picture*. Nothing reflows,
 * nothing repositions, no relative type size changes.
 *
 * **So the assertion with a number in it is the only one that can fail for a reason a teacher
 * cares about.** What does change is `max(12px, …)` on type: below a certain container width
 * it takes over, and type stops shrinking with the canvas and grows relative to the box it
 * was authored in. That is "does the slide hold together on a phone". A viewport test with no
 * number in it asserts that nothing happened.
 *
 * happy-dom computes no layout, so this asserts the wrapper's declared width, the manifest's
 * equality, and the arithmetic — not a rendered size. Saying which of the two is being
 * checked is the difference between a test and a decoration.
 */

afterEach(cleanup)

const preview = (container: HTMLElement): HTMLElement =>
  container.querySelector('.cs-preview') as HTMLElement

const viewport = (container: HTMLElement): HTMLElement =>
  preview(container).querySelector('.cs-preview-viewport') as HTMLElement

const choose = (container: HTMLElement, preset: string): void => {
  const radio = preview(container).querySelector(
    `input[name="cs-preview-preset"][value="${preset}"]`,
  ) as HTMLInputElement
  act(() => radio.click())
}

describe('a preset sets the width of the preview’s viewport wrapper', () => {
  it('sets it, rather than capping it', () => {
    // Not "the stage container" — `.cs-stage` *is* the container, and it is the element the
    // preset must specifically not touch. And a width rather than a maximum, because the
    // preview is a `<dialog>` whose suggested rendering is `width: fit-content`: a maximum
    // would cap an element with no width of its own.
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    for (const preset of ['desktop', 'tablet', 'mobile'] as const) {
      choose(container, preset)
      expect(viewport(container).style.width).toBe(`${PREVIEW_PRESETS[preset]}px`)
      expect(viewport(container).style.maxWidth).toBe('100%')
    }
  })

  it('leaves the stage’s own aspect ratio and canvas untouched', () => {
    const { container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const stage = preview(container).querySelector('.cs-stage') as HTMLElement
    const before = stage.getAttribute('style')
    choose(container, 'mobile')
    expect((preview(container).querySelector('.cs-stage') as HTMLElement).getAttribute('style')).toBe(
      before,
    )
  })

  it('leaves the manifest byte-identical', () => {
    const lesson = multiSlideLesson()
    const before = JSON.stringify(lesson)
    const { handle, container } = renderEditor(lesson, { preview: 'beginning' })
    choose(container, 'tablet')
    choose(container, 'mobile')
    expect(JSON.stringify(handle.session.draft)).toBe(before)
  })
})

describe('the presets straddle the player’s type floors', () => {
  it('places each one on the side of the floors it is meant to show', () => {
    // The only assertion here that can fail for a reason a teacher would notice. A preset set
    // above every floor would satisfy every other test in this file while showing nothing:
    // the lesson scales proportionally, so it would be the same picture, smaller.
    const floors = floorsFor(1600)
    expect(floors.body).toBeCloseTo(600, 5)
    expect(floors.caption).toBeCloseTo(960, 5)
    expect(floors.ui).toBeCloseTo(800, 5)

    // Desktop: above every floor. The lesson renders exactly as authored.
    expect(PREVIEW_PRESETS.desktop).toBeGreaterThan(floors.caption)
    // Tablet: captions and UI labels are already larger than authored; body text is not.
    expect(PREVIEW_PRESETS.tablet).toBeLessThan(floors.caption)
    expect(PREVIEW_PRESETS.tablet).toBeGreaterThan(floors.body)
    // Mobile: all three. The case a teacher opens this feature to check.
    expect(PREVIEW_PRESETS.mobile).toBeLessThan(floors.body)
  })

  it('derives the floors from the canvas rather than hard-coding them', () => {
    // A 9:16 lesson is 900 logical units wide, so its floors sit elsewhere. A preset chosen
    // against a device's marketing number rather than against the canvas would be right for
    // one aspect ratio by accident.
    const portrait = floorsFor(900)
    expect(portrait.body).toBeLessThan(floorsFor(1600).body)
  })
})

describe('the preset does not survive the preview', () => {
  it('is back to desktop when the preview reopens', () => {
    const { handle, container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    choose(container, 'mobile')
    expect(viewport(container).getAttribute('data-cs-preview-preset')).toBe('mobile')

    const close = preview(container).querySelector('[data-cs-preview-close]') as HTMLElement
    act(() => close.click())
    handle.openPreview('beginning')
    expect(viewport(container).getAttribute('data-cs-preview-preset')).toBe('desktop')
  })

  it('never appears in a saved manifest', () => {
    const lesson = multiSlideLesson()
    const { handle, container } = renderEditor(lesson, { preview: 'beginning' })
    choose(container, 'tablet')
    expect(JSON.stringify(handle.session.draft)).not.toContain('tablet')
    expect(JSON.stringify(handle.session.draft)).not.toContain('preset')
  })
})
