import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderEditor, runFrames } from '../harness/editor.js'
import { multiSlideLesson } from '../harness/preview.js'
import { questionElement } from '../harness/preview.js'
import { element, lessonOf, slide } from '../harness/corpus.js'

/**
 * Where a preview begins, what it does next, and where restart returns to.
 *
 * §17.3 names "time-consuming restart" as the friction this story removes: a teacher checking
 * a moment eight slides in should not watch the seven before it. All three entry points end
 * in one seek through `onReady`, and everything after that seek is the player's.
 */

afterEach(cleanup)

const preview = (container: HTMLElement): HTMLElement =>
  container.querySelector('.cs-preview') as HTMLElement

const visibleIds = (container: HTMLElement): string[] =>
  [...preview(container).querySelectorAll('[data-cs-element-id]')].map(
    (n) => n.getAttribute('data-cs-element-id')!,
  )

/** A first slide whose second element only exists from 2 000 ms. */
const lateLesson = () =>
  lessonOf([
    slide(
      [
        element({ id: 'fx-early', startMs: 0, endMs: 4000, payload: { text: 'early' } }),
        element({ id: 'fx-late', startMs: 2000, endMs: 4000, payload: { text: 'late' } }),
      ],
      { durationMs: 4000 },
    ),
    slide([element({ id: 'fx-second', payload: { text: 'second' } })], { durationMs: 4000 }),
  ])

describe('previewing from the current position', () => {
  it('begins at that moment rather than at the slide’s zero', () => {
    const lesson = lateLesson()
    const { container } = renderEditor(lesson, { preview: 'position', timeline: true })
    // The editor's authoring time starts at 0, so this preview starts there too — the
    // control case, and the reason the next assertion is not vacuous.
    expect(visibleIds(container)).not.toContain('fx-late')
    cleanup()

    const opened = renderEditorAt(lesson, 2500)
    expect(visibleIds(opened.container)).toContain('fx-late')
  })

  it('shows a learner’s view of that moment, not the editor’s', () => {
    const { container } = renderEditor(multiSlideLesson(), { preview: 'position' })
    expect(preview(container).querySelector('.cs-overlay')).toBeNull()
    expect(preview(container).querySelector('.cs-stage')).not.toBeNull()
  })
})

describe('a preview started mid-lesson runs on', () => {
  it('reaches the next slide under that slide’s own advance rule', async () => {
    // Driven by the harness's `runFrames` against the fake clock, never by waiting. The
    // 100 ms default step is not decoration: `createClock` caps a single tick at 250 ms, so
    // one 2 500 ms jump would yield 250 ms of lesson time and this would silently assert
    // nothing. Feature 006 lost an afternoon to exactly that.
    const { handle, container } = renderEditor(multiSlideLesson(), { preview: 'beginning' })
    const first = visibleIds(container)
    await runFrames(handle.previewPorts, 4400)
    const later = visibleIds(container)
    expect(later).not.toEqual(first)
  })
})

describe('restart', () => {
  it('returns to the position the preview began at, not the lesson’s beginning', async () => {
    const lesson = lateLesson()
    const opened = renderEditorAt(lesson, 2500)
    expect(visibleIds(opened.container)).toContain('fx-late')

    // Play on into the second slide, so "back to the beginning" and "back to where this
    // preview started" are visibly different answers.
    await runFrames(opened.handle.previewPorts, 2000)
    expect(visibleIds(opened.container)).toContain('fx-second')

    const restart = preview(opened.container).querySelector(
      '[data-cs-preview-restart]',
    ) as HTMLElement
    act(() => restart.click())
    // 2 500 ms into the first slide: the late element is showing and the second slide is not.
    expect(visibleIds(opened.container)).toContain('fx-late')
    expect(visibleIds(opened.container)).not.toContain('fx-second')
  })

  it('replays into a fresh lesson: a question answered before it gates again', async () => {
    // The assertion a restart written as a seek fails while passing every other test here.
    // The answers live in the player's own interaction state, which exposes no reset, and the
    // advance controller never re-decides a slide whose instance id has not moved — which
    // `transport.restart()` does not move. Half the reason a teacher restarts is "does that
    // question actually stop it?", and a sticky run answers no.
    const gated = lessonOf([
      slide([questionElement({ id: 'fx-gate' })], { durationMs: 1000 }),
      slide([element({ id: 'fx-beyond', payload: { text: 'beyond' } })], { durationMs: 1000 }),
    ])
    const { handle, container } = renderEditor(gated, { preview: 'beginning' })

    // Scoped to the question, not to the preview: the viewport preset is a radio group too,
    // and it comes first in the DOM. A first draft of this helper answered "desktop".
    const answerTheQuestion = () => {
      const question = preview(container).querySelector('.cs-element-question') as HTMLElement
      const option = question.querySelector('input[type="radio"]') as HTMLInputElement
      act(() => option.click())
      const submit = question.querySelector('.cs-question-submit') as HTMLElement
      act(() => submit.click())
    }

    // The gate holds while it is unanswered — the control that makes the rest meaningful.
    await runFrames(handle.previewPorts, 1600)
    expect(visibleIds(container)).toContain('fx-gate')

    // Answering releases it, which proves the answer path actually works here.
    answerTheQuestion()
    await runFrames(handle.previewPorts, 1600)
    expect(visibleIds(container)).toContain('fx-beyond')

    // And restart puts the gate back. A seek-based restart returns to the right position in
    // a lesson where this question is still answered, and never reaches this line's failure.
    const restart = preview(container).querySelector('[data-cs-preview-restart]') as HTMLElement
    act(() => restart.click())
    await runFrames(handle.previewPorts, 1600)
    expect(visibleIds(container)).toContain('fx-gate')
    expect(visibleIds(container)).not.toContain('fx-beyond')
  })
})

/**
 * Open a preview from a given authoring time on the first slide.
 *
 * The harness drives `from` and the session's own time; this moves the playhead first, then
 * mounts, which is the sequence a teacher performs and the only way `from: 'position'` has
 * anything to capture.
 */
function renderEditorAt(lesson: ReturnType<typeof multiSlideLesson>, atMs: number) {
  const rendered = renderEditor(lesson, { timeline: true })
  act(() => rendered.handle.playback.seek(atMs))
  rendered.handle.openPreview('position')
  return rendered
}
