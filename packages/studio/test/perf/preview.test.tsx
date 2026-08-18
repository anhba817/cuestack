import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import type { LessonManifest } from '@cuestack/schema'
import { heavyLesson } from '../harness/heavy.js'
import { renderEditor } from '../harness/editor.js'

/**
 * Opening a preview is a mount, and it must not cost more than the editor did.
 *
 * NFR-PERF-001 gives the editor three seconds to become interactive at 50 slides and 300
 * elements. The preview inherits that budget rather than inventing one: it renders the same
 * elements through the same renderers, minus an overlay.
 *
 * **Measured on the dense slide, and while the editor is playing.** Feature 006's fixture
 * puts 55 of the 300 elements on the last slide, because a six-element slide measures
 * nothing — the trap that feature's R-09 describes. And the editor is playing when the
 * preview opens, because that is the expensive case: `usePlayback` runs a frame loop for as
 * long as its state is `playing`, so a preview opened mid-playback would run two of them over
 * one slide unless opening stops the first. Measured against an idle editor, this budget
 * would never see the frame loop it exists to prevent.
 *
 * **What this does not measure.** happy-dom has no compositor, so this is the mount's own
 * work — resolve, render, commit — and not paint. A pass here is not a frame-rate claim.
 */

afterEach(cleanup)

const MARGIN = 0.9
const MOUNT_MS = 3000 * MARGIN

function elapsed(fn: () => void): number {
  const started = performance.now()
  fn()
  return performance.now() - started
}

describe('opening a preview on the dense slide', () => {
  const fixture = heavyLesson() as LessonManifest
  /** The densest one: 55 elements, which is what a mount actually faces. */
  const dense = { ...fixture, slides: [fixture.slides[fixture.slides.length - 1]!] }

  it('is measured against a slide that can stress it', () => {
    expect(dense.slides[0]!.elements.length).toBeGreaterThanOrEqual(50)
  })

  it('stays inside the editor’s own interactive budget', () => {
    const { handle } = renderEditor(dense, { timeline: true })
    act(() => handle.playback.play())

    const cost = elapsed(() => {
      handle.playback.pause()
      handle.openPreview('position')
    })
    expect(cost).toBeLessThan(MOUNT_MS)
  })

  it('leaves one clock running, not two', () => {
    // The assertion the budget above cannot make on its own: a cost inside the budget with
    // two frame loops running is still two frame loops, and the second one is invisible until
    // a teacher's machine is doing something else.
    const { handle } = renderEditor(dense, { timeline: true })
    act(() => handle.playback.play())
    expect(handle.playback.state).toBe('playing')

    act(() => handle.playback.pause())
    handle.openPreview('position')
    expect(handle.playback.state).not.toBe('playing')
  })
})
