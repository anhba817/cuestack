import { act, fireEvent, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakePorts, renderEditor } from '../harness/editor.js'
import { element, lessonWith } from '../harness/corpus.js'
import { NUDGE_MS } from '../../src/timeline/constants.js'

/**
 * Every action in User Stories 1–5, performed with no pointer events at all (SC-009).
 *
 * **The focus model is the canvas's, chosen deliberately rather than inherited by accident.**
 * Feature 005's overlay uses real buttons — "focus and activation come from the platform" —
 * and the timeline does the same: one focusable control per affordance, no roving tabindex.
 *
 * The cost is real and worth naming: at T004's dense slide a keyboard user tabs through 55
 * tracks to reach the transport. The alternative — one stop for the list with arrow-key
 * traversal inside it — would be a second focus model in one editor, and a teacher who
 * learned the canvas would have to learn the timeline separately. Consistency won (§7.1, and
 * Constitution III's "inconsistency is indistinguishable from a bug"). Should the dense case
 * prove painful in the manual pass, the transport controls are rendered *before* the tracks
 * precisely so the common destination comes first.
 */

const ui = (c: HTMLElement) => within(c)
const open = (elements: ReturnType<typeof element>[], options = {}) =>
  renderEditor(lessonWith(elements), { timeline: true, sequence: true, ports: fakePorts(), ...options })

describe('US1 — seeing and playing, by keyboard', () => {
  it('moves the playhead', () => {
    const { handle, container } = open([element()])
    const playhead = ui(container).getByRole('slider', { name: /authoring time/i })
    act(() => void fireEvent.change(playhead, { target: { value: '2500' } }))
    expect(handle.session.authoringTime).toBe(2500)
  })

  it('reads the current time, with a subject', () => {
    const { container } = open([element()])
    const playhead = ui(container).getByRole('slider', { name: /authoring time/i })
    expect(playhead.getAttribute('aria-valuetext')).toMatch(/authoring time.*second/i)
  })

  it('plays, pauses, and restarts from real buttons', () => {
    const { handle, container } = open([element()])
    act(() => void fireEvent.click(ui(container).getByRole('button', { name: /^play$/i })))
    expect(handle.playback.state).toBe('playing')

    act(() => void fireEvent.click(ui(container).getByRole('button', { name: /^pause$/i })))
    expect(handle.playback.state).toBe('paused')

    act(() => void fireEvent.click(ui(container).getByRole('button', { name: /restart/i })))
    expect(handle.playback.atMs).toBe(0)
  })

  it('moves between tracks — each is a real button, in document order', () => {
    const a = element({ payload: { text: 'alpha' } })
    const b = element({ payload: { text: 'beta' } })
    const { container } = open([a, b])
    const bars = [
      ui(container).getByTestId(`cs-bar-${a.id}`),
      ui(container).getByTestId(`cs-bar-${b.id}`),
    ]
    for (const bar of bars) {
      act(() => bar.focus())
      expect(document.activeElement).toBe(bar)
    }
  })

  it('changes the time scale', () => {
    const { container } = open([element()])
    const scale = ui(container).getByLabelText(/time scale/i)
    act(() => void fireEvent.change(scale, { target: { value: '240' } }))
    expect((scale as HTMLInputElement).value).toBe('240')
  })
})

describe('US2 — re-timing by keyboard', () => {
  it('moves a bar and resizes from a handle', () => {
    const el = element({ startMs: 1000, endMs: 3000 })
    const { handle, container } = open([el])

    act(() => void fireEvent.keyDown(ui(container).getByTestId(`cs-bar-${el.id}`), { key: 'ArrowRight' }))
    expect(handle.session.draft.slides[0]!.elements[0]!.startMs).toBe(1000 + NUDGE_MS)

    // The move above took the end with it — that is what moving a bar means — so the resize
    // starts from 3000 + NUDGE_MS and adds one more step.
    act(() =>
      void fireEvent.keyDown(ui(container).getByTestId(`cs-handle-end-${el.id}`), { key: 'ArrowRight' }),
    )
    expect(handle.session.draft.slides[0]!.elements[0]!.endMs).toBe(3000 + NUDGE_MS * 2)
    expect(handle.session.draft.slides[0]!.elements[0]!.startMs).toBe(1000 + NUDGE_MS)
  })
})

describe('US3 — authoring an effect by keyboard', () => {
  it('adds, configures, and removes an effect, all from the keyboard', () => {
    const el = element()
    const { handle, container } = renderEditor(lessonWith([el]), { inspector: true })
    act(() => handle.session.select([el.id]))

    act(() => void fireEvent.change(ui(container).getByLabelText('Effect'), { target: { value: 'pulse' } }))
    act(() => void fireEvent.click(ui(container).getByRole('button', { name: /add effect/i })))

    const effects = () =>
      (handle.session.draft.slides[0]!.elements[0] as unknown as { effects?: unknown[] }).effects ?? []
    expect(effects()).toHaveLength(1)

    act(() => void fireEvent.change(ui(container).getByLabelText(/duration/i), { target: { value: '900' } }))
    act(() => void fireEvent.change(ui(container).getByLabelText('Amount'), { target: { value: '0.3' } }))

    // One press now: feature 008 removed the two-step confirmation, because an effect removed
    // by mistake is one undo away.
    act(() => void fireEvent.click(ui(container).getByRole('button', { name: /^remove the pulse effect$/i })))
    expect(effects()).toHaveLength(0)

    act(() => handle.session.undo())
    expect(effects()).toHaveLength(1)
  })
})

describe('US4 — sequencing by keyboard', () => {
  it('sets a relationship on a Custom event in one action', () => {
    const { handle, container } = open([
      element({ startMs: 0, endMs: 4000 }),
      element({ startMs: 2000, endMs: 6000 }),
    ])

    act(() => void fireEvent.change(ui(container).getByLabelText('Starts'), { target: { value: 'after-previous' } }))
    expect(handle.session.draft.slides[0]!.elements[1]!.startMs).toBe(4000)

    // And the authored timing is one undo away, which is what the confirmation stood in for.
    act(() => handle.session.undo())
    expect(handle.session.draft.slides[0]!.elements[1]!.startMs).toBe(2000)
  })
})

describe('US5 — extending the slide by keyboard', () => {
  it('takes the offered action from a real button', () => {
    const { handle, container } = renderEditor(
      lessonWith([element({ startMs: 0, endMs: 12_000 })], { durationMs: 8000 }),
      { timeline: true, ports: fakePorts() },
    )
    act(() => void fireEvent.click(ui(container).getByRole('button', { name: /extend the slide/i })))
    expect(handle.session.draft.slides[0]!.durationMs).toBe(12_000)
  })
})
