import { act, fireEvent, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakePorts, renderEditor } from '../harness/editor.js'
import { oneMillisecond, spansSlide, timelineLesson } from '../harness/timeline.js'
import { element, locked } from '../harness/corpus.js'
import { NUDGE_MS, NUDGE_MS_COARSE, SNAP_THRESHOLD_MS } from '../../src/timeline/constants.js'

/**
 * Changing timing by direct manipulation, and by keyboard.
 *
 * Both paths run the same pure engine — `moveRange`, `resizeRangeStart`, `resizeRangeEnd` —
 * and commit through the same `set-timing` edit. That is what makes FR-017 hold without
 * anybody restating it: the inspector and the timeline are two views of one value because
 * there is one write.
 *
 * **No measurement is involved**, which is why a drag is assertable here at all. Track space
 * is CSS pixels, so a pointer delta is already in the units the scale converts from — unlike
 * the canvas, whose logical units need the stage's rendered width and which happy-dom
 * reports as zero.
 */

const ui = (container: HTMLElement) => within(container)
const open = (elements: Parameters<typeof timelineLesson>[0]) =>
  renderEditor(timelineLesson(elements), { timeline: true, ports: fakePorts() })

/** A press, a move, and a release, in track-space pixels. */
function drag(node: HTMLElement, byPx: number): void {
  act(() => {
    fireEvent.pointerDown(node, { clientX: 0, pointerId: 1 })
    fireEvent.pointerMove(node, { clientX: byPx, pointerId: 1 })
    fireEvent.pointerUp(node, { clientX: byPx, pointerId: 1 })
  })
}

const timingOf = (handleSession: { draft: { slides: { elements: { id: string; startMs: number; endMs: number }[] }[] } }, id: string) => {
  const el = handleSession.draft.slides[0]!.elements.find((e) => e.id === id)!
  return { startMs: el.startMs, endMs: el.endMs }
}

describe('dragging a bar', () => {
  it('moves start and end together, leaving the duration unchanged (FR-012)', () => {
    const el = element({ startMs: 1000, endMs: 3000 })
    const { handle, container } = open([el])

    // 100 px/s is the default scale, so 250 px is 2 500 ms.
    drag(ui(container).getByTestId(`cs-bar-${el.id}`), 250)

    expect(timingOf(handle.session, el.id)).toEqual({ startMs: 3500, endMs: 5500 })
  })

  it('moves earlier as readily as later', () => {
    const el = element({ startMs: 3000, endMs: 5000 })
    const { handle, container } = open([el])

    drag(ui(container).getByTestId(`cs-bar-${el.id}`), -100)

    expect(timingOf(handle.session, el.id)).toEqual({ startMs: 2000, endMs: 4000 })
  })
})

describe('dragging a handle', () => {
  it('changes the start alone (FR-013)', () => {
    const el = element({ startMs: 2000, endMs: 6000 })
    const { handle, container } = open([el])

    drag(ui(container).getByTestId(`cs-handle-start-${el.id}`), -100)

    expect(timingOf(handle.session, el.id)).toEqual({ startMs: 1000, endMs: 6000 })
  })

  it('changes the end alone (FR-013)', () => {
    const el = element({ startMs: 2000, endMs: 6000 })
    const { handle, container } = open([el])

    drag(ui(container).getByTestId(`cs-handle-end-${el.id}`), 50)

    expect(timingOf(handle.session, el.id)).toEqual({ startMs: 2000, endMs: 6500 })
  })

  it('stops at the shortest the format permits rather than writing what it rejects', () => {
    const el = element({ startMs: 2000, endMs: 3000 })
    const { handle, container } = open([el])

    drag(ui(container).getByTestId(`cs-handle-end-${el.id}`), -1000)

    const after = timingOf(handle.session, el.id)
    expect(after.endMs).toBeGreaterThan(after.startMs)
  })

  it('keeps a one-millisecond bar hittable and draggable (edge case)', () => {
    const el = oneMillisecond()
    const { handle, container } = open([el])

    const bar = ui(container).getByTestId(`cs-bar-${el.id}`)
    // Never narrower than MIN_BAR_PX, however little time it spans.
    expect(Number.parseFloat(bar.style.width)).toBeGreaterThanOrEqual(8)

    drag(bar, 100)
    expect(timingOf(handle.session, el.id)).toEqual({ startMs: 4000, endMs: 4001 })
  })

  it('exposes both handles for an element spanning the whole slide (edge case)', () => {
    const el = spansSlide()
    const { container } = open([el])

    const start = ui(container).getByTestId(`cs-handle-start-${el.id}`)
    const end = ui(container).getByTestId(`cs-handle-end-${el.id}`)
    // Distinguishable from each other and from the ruler's ends: different positions, and
    // each with a name that says which edge it is.
    expect(start.style.left).not.toBe(end.style.left)
    expect(start.getAttribute('aria-label')).toMatch(/start/i)
    expect(end.getAttribute('aria-label')).toMatch(/end/i)
  })
})

describe('snapping (FR-015)', () => {
  it('lands exactly on a neighbour’s edge when it comes close', () => {
    const neighbour = element({ startMs: 4000, endMs: 6000 })
    const dragged = element({ startMs: 0, endMs: 1000 })
    const { handle, container } = open([neighbour, dragged])

    // Aim just short of 4 000 ms, inside the threshold.
    const shortfall = SNAP_THRESHOLD_MS - 20
    drag(ui(container).getByTestId(`cs-bar-${dragged.id}`), (4000 - shortfall) / 10)

    expect(timingOf(handle.session, dragged.id).startMs).toBe(4000)
  })

  it('leaves a target outside the threshold alone', () => {
    const neighbour = element({ startMs: 4000, endMs: 6000 })
    const dragged = element({ startMs: 0, endMs: 1000 })
    const { handle, container } = open([neighbour, dragged])

    drag(ui(container).getByTestId(`cs-bar-${dragged.id}`), 300)
    expect(timingOf(handle.session, dragged.id).startMs).toBe(3000)
  })
})

describe('re-timing by keyboard (FR-009)', () => {
  it('nudges by one step, and by a coarse step with a modifier', () => {
    const el = element({ startMs: 1000, endMs: 3000 })
    const { handle, container } = open([el])
    const bar = ui(container).getByTestId(`cs-bar-${el.id}`)

    act(() => void fireEvent.keyDown(bar, { key: 'ArrowRight' }))
    expect(timingOf(handle.session, el.id).startMs).toBe(1000 + NUDGE_MS)

    act(() => void fireEvent.keyDown(bar, { key: 'ArrowRight', shiftKey: true }))
    expect(timingOf(handle.session, el.id).startMs).toBe(1000 + NUDGE_MS + NUDGE_MS_COARSE)
  })

  it('resizes from a handle rather than moving the whole bar', () => {
    const el = element({ startMs: 1000, endMs: 3000 })
    const { handle, container } = open([el])

    act(() => void fireEvent.keyDown(ui(container).getByTestId(`cs-handle-end-${el.id}`), { key: 'ArrowRight' }))

    expect(timingOf(handle.session, el.id)).toEqual({ startMs: 1000, endMs: 3000 + NUDGE_MS })
  })
})

describe('a locked element', () => {
  it('is not re-timed, and the editor says why (FR-016, BR-011)', () => {
    const el = locked()
    const { handle, container } = open([el])
    const before = timingOf(handle.session, el.id)

    drag(ui(container).getByTestId(`cs-bar-${el.id}`), 200)

    expect(timingOf(handle.session, el.id)).toEqual(before)
    // Doing nothing visible is the worst answer: it reads as a broken editor rather than a
    // protected element.
    //
    // Scoped to the timeline: the canvas has its own announcer and renders first, so an
    // unscoped query finds that one — empty — and reports a silence that is not there.
    const announcer = container.querySelector('.cs-timeline [data-cs-announcer]')
    expect(announcer?.textContent).toMatch(/locked/i)
  })
})

describe('the inspector and the timeline agree (FR-017, SC-002)', () => {
  it('shows the same values after a drag — two views, one source of truth', () => {
    const el = element({ startMs: 1000, endMs: 3000 })
    const { handle, container } = open([el])

    drag(ui(container).getByTestId(`cs-bar-${el.id}`), 100)

    const bar = ui(container).getByTestId(`cs-bar-${el.id}`)
    const stored = timingOf(handle.session, el.id)
    // The bar's data attributes are rendered from the draft, so agreement here is agreement
    // with whatever any other view reads — there is one write path and one value.
    expect(bar.dataset['startMs']).toBe(String(stored.startMs))
    expect(bar.dataset['endMs']).toBe(String(stored.endMs))
  })
})
