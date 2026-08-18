import { describe, expect, it } from 'vitest'
import { startPointFor } from '../../src/preview/startPoint.js'
import { multiSlideLesson } from '../harness/preview.js'
import type { EditorSession } from '../../src/session/useEditorSession.js'

/**
 * The one translation between editor state and playback state.
 *
 * Pure and DOM-free, which is why it is a function rather than three branches in a component:
 * the three cases are exactly the kind of thing that is easy to get subtly wrong and
 * expensive to debug through a rendered tree. The `.pure.` in the filename puts it in the
 * project with no `document` at all, so a DOM dependency creeping in fails immediately.
 */

const lesson = multiSlideLesson()

const sessionAt = (slideIndex: number, authoringTime: number): EditorSession =>
  ({
    draft: lesson,
    slideId: lesson.slides[slideIndex]!.id,
    authoringTime,
  }) as unknown as EditorSession

describe('startPointFor', () => {
  it('sends "beginning" to the lesson’s first slide at zero', () => {
    expect(startPointFor(sessionAt(2, 3000), 'beginning')).toEqual({ slideIndex: 0, atMs: 0 })
  })

  it('sends "slide" to the current slide’s own zero', () => {
    expect(startPointFor(sessionAt(1, 3000), 'slide')).toEqual({ slideIndex: 1, atMs: 0 })
  })

  it('sends "position" to the current slide at the authoring time', () => {
    expect(startPointFor(sessionAt(1, 1500), 'position')).toEqual({ slideIndex: 1, atMs: 1500 })
  })

  it('clamps a playhead resting on the slide’s exact duration', () => {
    // The playhead can sit at `durationMs` — the ruler ends there — while element windows are
    // half-open, so seeking to it renders an empty stage and looks like a broken preview.
    // One millisecond back is the last moment the slide actually has.
    expect(startPointFor(sessionAt(0, 4000), 'position')).toEqual({ slideIndex: 0, atMs: 3999 })
  })

  it('clamps a negative authoring time to zero', () => {
    expect(startPointFor(sessionAt(0, -50), 'position')).toEqual({ slideIndex: 0, atMs: 0 })
  })

  it('falls back to the first slide when the session names one the draft does not have', () => {
    const orphan = { draft: lesson, slideId: 'gone', authoringTime: 900 } as unknown as EditorSession
    expect(startPointFor(orphan, 'slide')).toEqual({ slideIndex: 0, atMs: 0 })
  })
})
