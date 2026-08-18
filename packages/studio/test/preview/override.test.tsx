import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderEditor, runFrames } from '../harness/editor.js'
import { fakePlayerPorts, gatedLesson } from '../harness/preview.js'
import { createElement as h } from 'react'
import { render } from '@testing-library/react'
import { LessonPlayer } from '@cuestack/react'

/** Mount the player on its own, for the control below. */
const client = async (node: React.ReactElement) => {
  render(node)
}

/**
 * One switch that lets every gate through, and only while the preview is open.
 *
 * FR-017 is not "the override works" — it is **one action, not one per gate**. A teacher
 * eight slides in, each gated, must not answer eight questions to reach the ninth. That is
 * why the fixture has three gated slides: a single gate cannot tell the two behaviours apart.
 *
 * Nothing new decides whether a slide may advance. The kernel's controller has carried the
 * short-circuit since Wave 1 with nothing passing it, and it already outranks BR-005's
 * required-interaction gate — which is exactly what lets a teacher past a question they have
 * not answered.
 */

afterEach(cleanup)

const preview = (container: HTMLElement): HTMLElement =>
  container.querySelector('.cs-preview') as HTMLElement

const visibleIds = (container: HTMLElement): string[] =>
  [...preview(container).querySelectorAll('[data-cs-element-id]')].map(
    (n) => n.getAttribute('data-cs-element-id')!,
  )

const switchFor = (container: HTMLElement): HTMLInputElement =>
  preview(container).querySelector('[data-cs-preview-override]') as HTMLInputElement

const lastSlideId = (lesson: ReturnType<typeof gatedLesson>): string =>
  lesson.slides[lesson.slides.length - 1]!.elements[0]!.id

describe('one switch, every gate', () => {
  it('holds at the first gate while the switch is off', async () => {
    // The control that makes the next test mean something. Without it, a preview that always
    // ran to the end would pass the assertion below for the wrong reason.
    const lesson = gatedLesson()
    const { handle, container } = renderEditor(lesson, { preview: 'beginning' })
    await runFrames(handle.previewPorts, 8000)
    expect(visibleIds(container)).not.toContain(lastSlideId(lesson))
  })

  it('reaches the third gated slide without being asked again', async () => {
    const lesson = gatedLesson()
    const { handle, container } = renderEditor(lesson, { preview: 'beginning' })
    act(() => switchFor(container).click())
    await runFrames(handle.previewPorts, 8000)
    expect(visibleIds(container)).toContain(lastSlideId(lesson))
  })
})

describe('what the override does not do', () => {
  it('does not skip the slides themselves', async () => {
    // **Found in implementation, and it is the sharp edge of this story.** The kernel's
    // short-circuit outranks *every* condition, duration included — correct for the test
    // affordance it was written as, and wrong for a preview. Raised unconditionally, the
    // override made a lesson race to its own ending the instant the switch went on: a teacher
    // could skip a question and then see nothing at all.
    //
    // The signal is gated on the slide's own duration instead, so the override releases a
    // *gate* and never a slide's length. Every gate is bypassed and the lesson's timing is
    // preserved, which is what a preview is for.
    const lesson = gatedLesson()
    const { handle, container } = renderEditor(lesson, { preview: 'beginning' })
    act(() => switchFor(container).click())

    // Half of the first slide's two seconds. Still on it, override or no override.
    await runFrames(handle.previewPorts, 1000)
    expect(visibleIds(container)).not.toContain(lastSlideId(lesson))
  })
})

describe('the switch’s lifetime', () => {
  it('is off at every open', () => {
    const lesson = gatedLesson()
    const { handle, container } = renderEditor(lesson, { preview: 'beginning' })
    expect(switchFor(container).checked).toBe(false)

    act(() => switchFor(container).click())
    expect(switchFor(container).checked).toBe(true)

    // Close, reopen: a switch that remembered would be a switch a teacher set last week and
    // is now being lied to by.
    const close = preview(container).querySelector('[data-cs-preview-close]') as HTMLElement
    act(() => close.click())
    handle.openPreview('beginning')
    expect(switchFor(container).checked).toBe(false)
  })

  it('restores every gate the moment it goes off', async () => {
    // FR-020, and the reason the player reads the value through a ref: the controller is
    // built once in a mount effect, so a captured value would keep honouring whatever the
    // switch said at mount.
    const lesson = gatedLesson()
    const { handle, container } = renderEditor(lesson, { preview: 'beginning' })
    act(() => switchFor(container).click())
    await runFrames(handle.previewPorts, 2400)
    const reached = visibleIds(container)

    act(() => switchFor(container).click())
    expect(switchFor(container).checked).toBe(false)
    await runFrames(handle.previewPorts, 6000)
    // Held where the switch was turned off, rather than carrying on to the end.
    expect(visibleIds(container)).toEqual(reached)
  })
})

describe('the indicator', () => {
  it('says so continuously, not once', async () => {
    // A switch that lasts is a switch that gets forgotten, and a teacher who forgets will
    // conclude the lesson works when what worked was the switch. A notification that has gone
    // by the time they reach the slide they were testing is worse than none.
    const { handle, container } = renderEditor(gatedLesson(), { preview: 'beginning' })
    act(() => switchFor(container).click())
    expect(preview(container).querySelector('[data-cs-override-on]')).not.toBeNull()

    await runFrames(handle.previewPorts, 6000)
    expect(preview(container).querySelector('[data-cs-override-on]')).not.toBeNull()

    act(() => switchFor(container).click())
    expect(preview(container).querySelector('[data-cs-override-on]')).toBeNull()
  })

  it('says what it means rather than only that it is on', () => {
    const { container } = renderEditor(gatedLesson(), { preview: 'beginning' })
    act(() => switchFor(container).click())
    const text = preview(container).querySelector('[data-cs-override-on]')!.textContent ?? ''
    expect(text).toContain('not what a learner would experience')
  })
})

describe('what overriding leaves behind', () => {
  it('leaves the lesson byte-identical', async () => {
    const lesson = gatedLesson()
    const before = JSON.stringify(lesson)
    const { handle, container } = renderEditor(lesson, { preview: 'beginning' })
    act(() => switchFor(container).click())
    await runFrames(handle.previewPorts, 8000)
    expect(JSON.stringify(handle.session.draft)).toBe(before)
  })

  it('records nothing through the analytics port', async () => {
    // The leak that would otherwise be invisible. The player emits `lesson_started` on mount
    // and a `slide_completed` for every slide it passes — so a preview wired to the host's
    // telemetry would report a teacher's checking as a learner's progress, and every gate the
    // override skips as a completion nobody earned.
    //
    // The preview replaces the analytics adapter and nothing else, so the recorder handed in
    // here should stay empty however far the override carries the lesson.
    const { handle, container } = renderEditor(gatedLesson(), { preview: 'beginning' })
    act(() => switchFor(container).click())
    await runFrames(handle.previewPorts, 8000)
    expect(handle.previewPorts.events).toHaveLength(0)
  })

  it('and the recorder is one that would otherwise have filled', async () => {
    // The control, without which the assertion above passes on a broken recorder, a player
    // that never started, or a fixture with nothing to report. The same ports handed to the
    // player directly collect the events a learner's session produces.
    const ports = fakePlayerPorts()
    await client(
      h(LessonPlayer, { lesson: gatedLesson(), ports, autoPlay: true }),
    )
    expect(ports.events.length).toBeGreaterThan(0)
  })
})
