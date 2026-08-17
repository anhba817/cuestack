import { act, fireEvent, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderEditor } from '../harness/editor.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * Custom, and what leaving it costs.
 *
 * An event whose timing no simple relationship describes is shown as Custom rather than
 * silently reinterpreted (FR-031). Calling an overlap "With Previous" would rewrite a
 * teacher's meaning on the very screen they opened to read it.
 *
 * Returning it to a relationship *discards* the timing they authored, and undo does not exist
 * until ED-5 — so FR-032's confirmation states both numbers before anything moves.
 */

const ui = (c: HTMLElement) => within(c)

/** Two elements that overlap: the second begins while the first is still running. */
const overlapping = () =>
  renderEditor(
    lessonWith([
      element({ startMs: 0, endMs: 4000, payload: { text: 'title' } }),
      element({ startMs: 2000, endMs: 6000, payload: { text: 'body' } }),
    ]),
    { sequence: true },
  )

describe('an event no relationship describes', () => {
  it('is shown as Custom rather than reinterpreted (FR-031)', () => {
    const { container } = overlapping()
    const select = ui(container).getByLabelText('Starts') as HTMLSelectElement
    expect(select.value).toBe('custom')
  })

  it('still shows when it actually happens, so the teacher need not open the timeline', () => {
    const { container } = overlapping()
    expect(container.textContent).toContain('at 2.00s')
  })
})

describe('returning it to a simple relationship (FR-032)', () => {
  it('asks first, and moves nothing until it is answered', () => {
    const { handle, container } = overlapping()
    const before = handle.session.draft.slides[0]!.elements[1]!.startMs

    act(() => {
      fireEvent.change(ui(container).getByLabelText('Starts'), { target: { value: 'after-previous' } })
    })

    expect(ui(container).getByRole('alertdialog')).toBeTruthy()
    expect(handle.session.draft.slides[0]!.elements[1]!.startMs).toBe(before)
  })

  it('states the current time and the one the change would produce', () => {
    const { container } = overlapping()
    act(() => {
      fireEvent.change(ui(container).getByLabelText('Starts'), { target: { value: 'after-previous' } })
    })

    const message = ui(container).getByRole('alertdialog').textContent ?? ''
    // The problem, the affected object, and what will happen (NFR-USA-004).
    expect(message).toContain('body')
    expect(message).toContain('2.00')
    expect(message).toContain('4.00')
    expect(message).toMatch(/lost/i)
  })

  it('applies the relationship when confirmed', () => {
    const { handle, container } = overlapping()
    act(() => {
      fireEvent.change(ui(container).getByLabelText('Starts'), { target: { value: 'after-previous' } })
    })
    act(() => {
      fireEvent.click(ui(container).getByRole('button', { name: /move it/i }))
    })

    expect(handle.session.draft.slides[0]!.elements[1]!.startMs).toBe(4000)
  })

  it('keeps the authored timing when declined', () => {
    const { handle, container } = overlapping()
    act(() => {
      fireEvent.change(ui(container).getByLabelText('Starts'), { target: { value: 'after-previous' } })
    })
    act(() => {
      fireEvent.click(ui(container).getByRole('button', { name: /keep the timing/i }))
    })

    expect(handle.session.draft.slides[0]!.elements[1]!.startMs).toBe(2000)
    expect(ui(container).queryByRole('alertdialog')).toBeNull()
  })

  it('does not ask when the event was already simple', () => {
    // Nothing is discarded, so there is nothing to confirm. A dialogue here would be the
    // "are you sure" that teaches people to click through without reading.
    const { handle, container } = renderEditor(
      lessonWith([element({ startMs: 0, endMs: 1000 }), element({ startMs: 1000, endMs: 2000 })]),
      { sequence: true },
    )
    act(() => {
      fireEvent.change(ui(container).getByLabelText('Starts'), { target: { value: 'with-previous' } })
    })

    expect(ui(container).queryByRole('alertdialog')).toBeNull()
    expect(handle.session.draft.slides[0]!.elements[1]!.startMs).toBe(0)
  })
})
