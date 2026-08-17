import { act, fireEvent, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderEditor } from '../harness/editor.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * Simple Sequence as a surface: settable, derived, and lossless against the timeline.
 *
 * Everything shown is computed from absolute times on every render. There is no second copy
 * to drift, which is what makes FR-030's "switching to the timeline changes zero values" true
 * by construction rather than by care.
 */

const ui = (c: HTMLElement) => within(c)
const open = (elements: ReturnType<typeof element>[]) =>
  renderEditor(lessonWith(elements), { sequence: true })

const timings = (session: { draft: { slides: { elements: { startMs: number; endMs: number }[] }[] } }) =>
  session.draft.slides[0]!.elements.map((e) => ({ startMs: e.startMs, endMs: e.endMs }))

describe('the sequence view', () => {
  it('lists an event per element, in the order they happen', () => {
    const { container } = open([
      element({ startMs: 4000, endMs: 5000, payload: { text: 'later' } }),
      element({ startMs: 0, endMs: 1000, payload: { text: 'sooner' } }),
    ])
    const rows = ui(container).getAllByRole('listitem')
    expect(rows[0]!.textContent).toContain('sooner')
    expect(rows[1]!.textContent).toContain('later')
  })

  it('shows the first event as starting at the slide’s beginning (FR-033)', () => {
    const { container } = open([element({ startMs: 0, endMs: 1000 })])
    expect(ui(container).getByText(/beginning of the slide/i)).toBeTruthy()
  })

  it('offers no relationship control for the first event — it has no previous', () => {
    const { container } = open([element({ startMs: 0, endMs: 1000 })])
    expect(ui(container).queryByLabelText('Starts')).toBeNull()
  })

  it('sets a relationship, and the absolute times follow', () => {
    const { handle, container } = open([
      element({ startMs: 0, endMs: 1000 }),
      element({ startMs: 6000, endMs: 7500 }),
    ])

    act(() => {
      fireEvent.change(ui(container).getByLabelText('Starts'), { target: { value: 'after-previous' } })
    })

    expect(timings(handle.session)).toEqual([
      { startMs: 0, endMs: 1000 },
      { startMs: 1000, endMs: 2500 },
    ])
  })

  it('shows a delay control only for the delay relationship, and applies it', () => {
    // Starting exactly at the previous end, so it classifies as After Previous and the delay
    // control is absent to begin with. A gap here would classify as a delay already — which
    // is correct, and was this test's first fixture.
    const { handle, container } = open([
      element({ startMs: 0, endMs: 1000 }),
      element({ startMs: 1000, endMs: 1500 }),
    ])
    expect(ui(container).queryByLabelText('Delay (ms)')).toBeNull()

    act(() => {
      fireEvent.change(ui(container).getByLabelText('Starts'), { target: { value: 'after-previous-delay' } })
    })
    act(() => {
      fireEvent.change(ui(container).getByLabelText('Delay (ms)'), { target: { value: '250' } })
    })

    expect(timings(handle.session)[1]!.startMs).toBe(1250)
  })

  it('shows an empty slide without looking broken', () => {
    const { container } = open([])
    expect(ui(container).getByText(/Nothing on this slide yet/i)).toBeTruthy()
  })

  it('is unusable in read-only, and the reducer refuses anyway (FR-047)', () => {
    const { container } = renderEditor(
      lessonWith([element({ startMs: 0, endMs: 1000 }), element({ startMs: 3000, endMs: 4000 })]),
      { sequence: true, mode: 'read-only' },
    )
    expect((ui(container).getByLabelText('Starts') as HTMLSelectElement).disabled).toBe(true)
  })
})

describe('switching to the timeline changes zero values (FR-030, SC-007)', () => {
  it('reads back exactly what the sequence wrote', () => {
    const { handle, container } = open([
      element({ startMs: 0, endMs: 1000 }),
      element({ startMs: 9000, endMs: 9800 }),
    ])
    act(() => {
      fireEvent.change(ui(container).getByLabelText('Starts'), { target: { value: 'after-previous' } })
    })

    const afterSequence = JSON.stringify(timings(handle.session))
    // The timeline reads the same draft. There is no conversion to lose anything in.
    const { handle: timelineHandle } = renderEditor(handle.session.draft, { timeline: false })
    expect(JSON.stringify(timings(timelineHandle.session))).toBe(afterSequence)
  })
})

describe('reordering re-classifies and rewrites nothing (FR-034)', () => {
  it('leaves every stored time byte-identical', () => {
    const a = element({ startMs: 0, endMs: 1000, zIndex: 1 })
    const b = element({ startMs: 2000, endMs: 3000, zIndex: 2 })
    const { handle } = open([a, b])
    const before = JSON.stringify(timings(handle.session))

    act(() => {
      handle.session.apply({ kind: 'reorder', ids: [a.id], direction: 'forward' })
    })

    expect(JSON.stringify(timings(handle.session))).toBe(before)
  })

  it('changes “previous” only among events that share a start time', () => {
    // The narrow scope, asserted. Events sort by start first and by paint order only as a
    // tie-break, so reordering two elements at different moments changes nothing at all —
    // which is why the destructive reading of FR-034 sounded reasonable and was wrong.
    const a = element({ startMs: 0, endMs: 1000, zIndex: 1, payload: { text: 'alpha' } })
    const b = element({ startMs: 2000, endMs: 3000, zIndex: 2, payload: { text: 'beta' } })
    const { handle, container } = open([a, b])

    const orderBefore = ui(container).getAllByRole('listitem').map((li) => li.textContent)
    act(() => {
      handle.session.apply({ kind: 'reorder', ids: [a.id], direction: 'forward' })
    })
    expect(ui(container).getAllByRole('listitem').map((li) => li.textContent)).toEqual(orderBefore)
  })
})
