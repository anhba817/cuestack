import { act, fireEvent, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakePorts, renderEditor } from '../harness/editor.js'
import { element, lessonWith } from '../harness/corpus.js'
import { zeroDurationSlide } from '../harness/timeline.js'

/**
 * The overrun, shown where the teacher is looking.
 *
 * BR-017 has been unenforceable since Wave 0: feature 005 recorded that nothing must be
 * silently clamped and left the warning to validation. A timeline is the first surface that
 * can *show* an overrun rather than describe one.
 */

const ui = (c: HTMLElement) => within(c)
const open = (elements: ReturnType<typeof element>[], slideOverrides = {}) =>
  renderEditor(lessonWith(elements, slideOverrides), { timeline: true, ports: fakePorts() })

describe('an element running past the end of its slide', () => {
  it('is identified and attributed to the element it belongs to (FR-037)', () => {
    const el = element({ startMs: 0, endMs: 12_000 })
    const { container } = open([el], { durationMs: 8000 })

    const panel = ui(container).getByRole('status', { name: /timing problems/i })
    expect(panel.textContent).toContain(el.id)
  })

  it('states the problem, the element, and what to do (FR-040, NFR-USA-004)', () => {
    const { container } = open([element({ startMs: 0, endMs: 12_000 })], { durationMs: 8000 })
    const text = ui(container).getByRole('status', { name: /timing problems/i }).textContent ?? ''

    expect(text).toMatch(/12000|12,000/)
    expect(text).toMatch(/8000|8,000/)
    expect(text).toMatch(/extend the slide|trim/i)
  })

  it('names an effect that runs past the end, as well as its element', () => {
    const el = element({
      startMs: 0,
      endMs: 4000,
      effects: [{ id: 'fx-late', type: 'fade', phase: 'exit', startMs: 7800, durationMs: 500, order: 0 }],
    })
    const { container } = open([el], { durationMs: 8000 })
    expect(ui(container).getByRole('status', { name: /timing problems/i }).textContent).toContain('fx-late')
  })

  it('says nothing at all when nothing overruns (US5 §5)', () => {
    const { container } = open([element({ startMs: 0, endMs: 4000 })], { durationMs: 8000 })
    expect(ui(container).queryByRole('status', { name: /timing problems/i })).toBeNull()
  })
})

describe('the offered action', () => {
  it('extends the slide to contain the latest end, exactly (FR-038, SC-011)', () => {
    const { handle, container } = open([element({ startMs: 0, endMs: 12_000 })], { durationMs: 8000 })

    act(() => {
      fireEvent.click(ui(container).getByRole('button', { name: /extend the slide/i }))
    })

    expect(handle.session.draft.slides[0]!.durationMs).toBe(12_000)
  })

  it('says the number it would set, before it is pressed', () => {
    const { container } = open([element({ startMs: 0, endMs: 12_000 })], { durationMs: 8000 })
    expect(ui(container).getByRole('button', { name: /extend the slide to 12\.0 seconds/i })).toBeTruthy()
  })

  it('leaves nothing to report once it has been taken', () => {
    const { container } = open([element({ startMs: 0, endMs: 12_000 })], { durationMs: 8000 })
    act(() => {
      fireEvent.click(ui(container).getByRole('button', { name: /extend the slide/i }))
    })
    expect(ui(container).queryByRole('status', { name: /timing problems/i })).toBeNull()
  })

  it('is unavailable in read-only (FR-047)', () => {
    const { container } = renderEditor(lessonWith([element({ startMs: 0, endMs: 12_000 })], { durationMs: 8000 }), {
      timeline: true,
      mode: 'read-only',
      ports: fakePorts(),
    })
    const button = ui(container).getByRole('button', { name: /extend the slide/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})

describe('a duration reduced below an existing end (BR-017)', () => {
  it('leaves every authored value intact — nothing is silently clamped', () => {
    const el = element({ startMs: 0, endMs: 6000 })
    const { handle } = open([el], { durationMs: 8000 })

    act(() => {
      handle.session.apply({ kind: 'set-slide-field', path: ['durationMs'], value: 3000 })
    })

    const after = handle.session.draft.slides[0]!.elements[0]!
    expect(after.startMs).toBe(0)
    expect(after.endMs).toBe(6000)
  })

  it('reports the overrun the reduction created', () => {
    const { handle, container } = open([element({ startMs: 0, endMs: 6000 })], { durationMs: 8000 })
    expect(ui(container).queryByRole('status', { name: /timing problems/i })).toBeNull()

    act(() => {
      handle.session.apply({ kind: 'set-slide-field', path: ['durationMs'], value: 3000 })
    })

    expect(ui(container).getByRole('status', { name: /timing problems/i })).toBeTruthy()
  })
})

describe('a slide of zero duration', () => {
  it('is reported once, about the slide, rather than once per element', () => {
    // `collectProblems` tests `endMs > durationMs` and every element has `endMs >= 1`, so it
    // reports all of them — correctly. Repeating that per element would bury the real problem.
    // Two elements, because one overrunning element is an *element* problem and this is a
    // slide problem. Note also that `add-element` cannot help here: a new element would need
    // a window inside a slide of zero length, which the schema refuses.
    const { container } = renderEditor(zeroDurationSlide(), { timeline: true, ports: fakePorts() })

    const text = ui(container).getByRole('status', { name: /timing problems/i }).textContent ?? ''
    expect(text).toMatch(/nothing on it has time to finish/i)
  })
})
