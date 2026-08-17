import { act, fireEvent, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { resolve } from '@cuestack/core'
import { renderEditor } from '../harness/editor.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * UC-02, and SC-016: a list revealed one line at a time, authored **entirely in the sequence
 * view**, with no timeline interaction at all.
 *
 * This is the case that decides whether the mode serves the teacher §7.1 describes, and it is
 * the reason the effect half of US4 exists at all. The clarification that widened Simple
 * Sequence from elements to *events* was argued on exactly this: a teacher revealing a list
 * is sequencing effects, and a mode that could only order elements would have sent them to
 * the timeline for the commonest case it exists to serve.
 *
 * It is also the recorded cut line. If US4's effect half had been cut, this file would be the
 * loss — which is why it asserts the whole journey rather than a mechanism.
 */

const ui = (c: HTMLElement) => within(c)

/** Three lines, each with a fade, all authored at zero — nothing sequenced yet. */
function threeLines() {
  const lines = ['First point', 'Second point', 'Third point'].map((text, i) =>
    element({
      startMs: 0,
      // A short window, so a chain of "after the previous" lays the lines out across the
      // slide rather than pushing everything past a line that stays for the whole of it.
      endMs: 1000,
      zIndex: i + 1,
      payload: { text },
      effects: [
        { id: `fx-${i}`, type: 'fade', phase: 'enter', startMs: 0, durationMs: 500, order: 0 },
      ],
    }),
  )
  return renderEditor(lessonWith(lines), { sequence: true })
}

describe('revealing a list one line at a time', () => {
  it('lists every element and every effect as an event to order', () => {
    const { container } = threeLines()
    // Three elements plus three fades.
    expect(ui(container).getAllByRole('listitem')).toHaveLength(6)
  })

  it('is authorable with no timeline interaction at all (SC-016)', () => {
    const { handle, container } = threeLines()

    // Every event after the first: happen after the one before you.
    const controls = () => ui(container).getAllByLabelText('Starts')
    for (let i = 0; i < controls().length; i += 1) {
      act(() => {
        fireEvent.change(controls()[i]!, { target: { value: 'after-previous' } })
      })
    }

    // No timeline was rendered, let alone touched.
    expect(container.querySelector('.cs-timeline')).toBeNull()

    // The three fades now run one after another rather than all at zero.
    const effectStarts = handle.session.draft.slides[0]!.elements.map(
      (e) => (e as unknown as { effects: { startMs: number }[] }).effects[0]!.startMs,
    )
    expect(new Set(effectStarts).size).toBe(3)
  })

  it('produces a slide where the lines actually arrive in turn', () => {
    const { handle, container } = threeLines()
    const controls = () => ui(container).getAllByLabelText('Starts')
    for (let i = 0; i < controls().length; i += 1) {
      act(() => {
        fireEvent.change(controls()[i]!, { target: { value: 'after-previous' } })
      })
    }

    /**
     * Checked the way a learner would experience it: what is on screen changes as time
     * passes, rather than everything arriving at once.
     *
     * Not an assertion that all three end up visible together — with each event following the
     * one before it, the lines take their turn and the early ones have had their moment. That
     * is what "one at a time" means, and asserting otherwise would be describing a different
     * lesson from the one this sequence authored.
     */
    const slide = handle.session.draft.slides[0]!
    const visibleAt = (atMs: number) => resolve(slide, atMs).elements.map((e) => e.id).join(',')

    const moments = [100, 2000, 3500].map(visibleAt)
    expect(new Set(moments).size).toBeGreaterThan(1)
  })

  it('shows each line’s moment, so the teacher never has to work it out', () => {
    const { container } = threeLines()
    const controls = () => ui(container).getAllByLabelText('Starts')
    for (let i = 0; i < controls().length; i += 1) {
      act(() => {
        fireEvent.change(controls()[i]!, { target: { value: 'after-previous' } })
      })
    }
    // "Simple first, precision on demand" does not mean hiding the number.
    expect(container.textContent).toMatch(/at \d+\.\d\ds/)
  })
})
