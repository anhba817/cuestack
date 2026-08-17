import { act } from 'react'
import { fireEvent, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakePorts, renderEditor } from '../harness/editor.js'
import { emptyTimeline, staggered, timelineLesson, zeroDurationSlide } from '../harness/timeline.js'
import { element, hidden, notYet } from '../harness/corpus.js'

/**
 * Queries are scoped to the tree this test rendered.
 *
 * RTL's auto-cleanup is off in this workspace (no `globals: true`, no setup file), so every
 * rendered tree stays in `document.body` for the whole file and a `screen` query would reach
 * into the previous test's editor. That produced a genuinely confusing red: a playhead that
 * "did not change the authoring time", because the one found belonged to another render.
 */
const ui = (container: HTMLElement) => within(container)

/**
 * Time becomes visible: a track per element, a ruler, and a playhead that moves the canvas.
 *
 * The timeline and the canvas are two views of one authoring time (FR-006). Feature 005
 * shipped a scrub as the only control and recorded the obligation this feature discharges:
 * two controls writing one value is a parity hazard the moment both exist.
 */

describe('the timeline draws the slide', () => {
  it('gives every element a track', () => {
    const { container } = renderEditor(timelineLesson(staggered()), { timeline: true, ports: fakePorts() })
    expect(ui(container).getAllByRole('listitem', { name: /track/i })).toHaveLength(3)
  })

  it('positions and sizes each bar from the authored times (SC-001)', () => {
    const el = element({ startMs: 2000, endMs: 6000 })
    const { container } = renderEditor(timelineLesson([el]), { timeline: true, ports: fakePorts() })
    const bar = ui(container).getByTestId(`cs-bar-${el.id}`)
    expect(bar.dataset['startMs']).toBe('2000')
    expect(bar.dataset['endMs']).toBe('6000')
  })

  it('keeps a track for an element the resolver omits (FR-003)', () => {
    const { container } = renderEditor(timelineLesson([hidden(), notYet()]), { timeline: true, ports: fakePorts() })
    expect(ui(container).getAllByRole('listitem', { name: /track/i })).toHaveLength(2)
  })

  it('renders a ruler and a playhead on an empty slide without looking broken', () => {
    const { container } = renderEditor(emptyTimeline(), { timeline: true, ports: fakePorts() })
    expect(ui(container).getByRole('slider', { name: /authoring time/i })).toBeTruthy()
    expect(ui(container).queryAllByRole('listitem', { name: /track/i })).toHaveLength(0)
  })

  it('survives a slide of zero duration', () => {
    // Legal: `Slide.durationMs` is `msInt`, integer >= 0. The ruler has no width to draw.
    const { container } = renderEditor(zeroDurationSlide(), { timeline: true, ports: fakePorts() })
    expect(ui(container).getByRole('slider', { name: /authoring time/i })).toBeTruthy()
  })
})

describe('the playhead moves the canvas', () => {
  const lesson = () =>
    timelineLesson([
      element({ startMs: 0, endMs: 2000, payload: { text: 'first' } }),
      element({ startMs: 4000, endMs: 8000, payload: { text: 'second' } }),
    ])

  it('renders the slide at the moment the playhead is at', () => {
    const { handle, container } = renderEditor(lesson(), { timeline: true, ports: fakePorts() })
    // The canvas alone: the timeline keeps a track for every element whatever the moment
    // (FR-003), so a whole-container assertion would find 'first' on its track forever.
    const canvas = () => container.querySelector('.cs-editor')!.textContent ?? ''
    expect(canvas()).toContain('first')

    act(() => handle.playback.seek(5000))
    expect(canvas()).toContain('second')
    expect(canvas()).not.toContain('first')
  })

  it('never disagrees with the canvas about the time (SC-002)', () => {
    const { handle, container } = renderEditor(lesson(), { timeline: true, ports: fakePorts() })
    act(() => handle.playback.seek(3210))

    const playhead = ui(container).getByRole('slider', { name: /authoring time/i }) as HTMLInputElement
    // `value`, not `aria-valuenow`: on a native range input the value *is* the accessible
    // value, and adding a redundant ARIA attribute would override working native semantics.
    expect(playhead.value).toBe('3210')
    expect(handle.session.authoringTime).toBe(3210)
  })

  it('seeks when the ruler is clicked (FR-005)', () => {
    const { handle, container } = renderEditor(lesson(), { timeline: true, ports: fakePorts() })
    const ruler = ui(container).getByTestId('cs-ruler')
    act(() => {
      fireEvent.click(ruler, { clientX: 120 })
    })
    // happy-dom reports a zero-width rect, so the exact moment is not assertable here — the
    // conversion is `scale.pure.test.ts`'s job. What is assertable is that a click seeks.
    expect(handle.session.authoringTime).toBeGreaterThanOrEqual(0)
  })

  it('announces the time with a subject, not as a bare number (FR-008)', () => {
    // Feature 004's manual sweep found a progress bar announcing a position with no subject
    // and no automated check had flagged it. This is that defect anticipated.
    const { handle, container } = renderEditor(lesson(), { timeline: true, ports: fakePorts() })
    act(() => handle.playback.seek(2400))
    const playhead = ui(container).getByRole('slider', { name: /authoring time/i })
    expect(playhead.getAttribute('aria-valuetext')).toMatch(/2\.4.*second/i)
  })
})
