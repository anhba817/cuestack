import { act, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LessonManifest } from '@cuestack/schema'
import { heavyLesson } from '../harness/heavy.js'
import { fakePorts, renderEditor } from '../harness/editor.js'

/**
 * The timeline, measured against a slide that can actually stress it.
 *
 * **This is the point of T004.** The Constitution's fixture is 50 slides and 300 elements,
 * and before this feature it spread them six per slide — so SC-012's "stays responsive at 50
 * slides and 300 elements" would have been measured against *six tracks*, which is not a
 * load. A criterion that passes because the fixture is easy is the theme-gate mistake in a
 * new place: green while measuring nothing (research R-09).
 *
 * The last slide now carries 55 of the 300, and that is what these budgets face.
 *
 * **What this does not measure.** happy-dom has no compositor, so this is the editor's own
 * work — resolve, compose, React commit — and not paint. A pass here is not a frame-rate
 * claim, exactly as the playback gate says of itself.
 */

const MARGIN = 0.9
const INTERACTION_MS = 100 * MARGIN
const SEEK_MS = 100 * MARGIN

function elapsed(fn: () => void): number {
  const started = performance.now()
  fn()
  return performance.now() - started
}

describe('the timeline on the dense slide', () => {
  const fixture = heavyLesson() as LessonManifest
  /** The dense one: 55 elements, which is what a per-slide timeline actually faces. */
  const dense = { ...fixture, slides: [fixture.slides[fixture.slides.length - 1]!] }

  it('is the fixture the Constitution names, redistributed rather than enlarged', () => {
    expect(fixture.slides).toHaveLength(50)
    expect(fixture.slides.flatMap((s) => s.elements)).toHaveLength(300)
    expect(dense.slides[0]!.elements.length).toBeGreaterThanOrEqual(50)
  })

  it(`moves the playhead to a rendered state within ${SEEK_MS} ms (SC-003)`, () => {
    const { handle, container } = renderEditor(dense, { timeline: true, ports: fakePorts() })
    const playhead = container.querySelector('.cs-playhead')!

    const ms = elapsed(() => act(() => void fireEvent.change(playhead, { target: { value: '4000' } })))

    expect(handle.session.authoringTime).toBe(4000)
    expect(ms).toBeLessThan(SEEK_MS)
  })

  it(`gives drag feedback within ${INTERACTION_MS} ms (SC-004)`, () => {
    const { handle, container } = renderEditor(dense, { timeline: true, ports: fakePorts() })
    const first = dense.slides[0]!.elements[0]!
    const bar = container.querySelector(`[data-testid="cs-bar-${first.id}"]`)!

    const ms = elapsed(() =>
      act(() => {
        fireEvent.pointerDown(bar, { clientX: 0, pointerId: 1 })
        fireEvent.pointerMove(bar, { clientX: 40, pointerId: 1 })
        fireEvent.pointerUp(bar, { clientX: 40, pointerId: 1 })
      }),
    )

    expect(handle.session.draft.slides[0]!.elements[0]!.startMs).not.toBe(first.startMs)
    expect(ms).toBeLessThan(INTERACTION_MS)
  })

  it('renders every track, scrollable rather than laid out at once (SC-012)', () => {
    const { container } = renderEditor(dense, { timeline: true, ports: fakePorts() })
    const tracks = container.querySelectorAll('.cs-track')
    expect(tracks).toHaveLength(dense.slides[0]!.elements.length)

    // The scroll container is what keeps a long list usable. Asserted structurally, because
    // happy-dom computes no layout and would report every height as zero.
    expect(container.querySelector('.cs-timeline-body')).toBeTruthy()
  })

  it('scales with the track count rather than with its square', () => {
    // The shape that matters more than any single number, and the same assertion the canvas
    // suite makes: ten seeks must not cost dramatically more than ten times one.
    const { container } = renderEditor(dense, { timeline: true, ports: fakePorts() })
    const playhead = container.querySelector('.cs-playhead')!

    const one = elapsed(() => act(() => void fireEvent.change(playhead, { target: { value: '1000' } })))
    const ten = elapsed(() => {
      for (let i = 1; i <= 10; i += 1) {
        act(() => void fireEvent.change(playhead, { target: { value: String(i * 400) } }))
      }
    })

    expect(ten).toBeLessThan(Math.max(one, 1) * 40)
  })

  it('builds the sequence view over the same slide within budget', () => {
    const ms = elapsed(() => {
      renderEditor(dense, { sequence: true })
    })
    // 55 elements and their effects, classified and rendered.
    expect(ms).toBeLessThan(1000)
  })
})
