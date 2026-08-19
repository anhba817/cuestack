import { act, fireEvent, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakePorts, renderEditor } from '../harness/editor.js'
import { timelineLesson } from '../harness/timeline.js'
import { element } from '../harness/corpus.js'

/**
 * A timeline drag is one reversal step, and that is not a nicety.
 *
 * `timeline/Track.tsx` calls `onRetime` from `onPointerMove`, so a drag emits one `set-timing`
 * edit **per frame** — where `canvas/gesture.ts` deliberately commits once on release and says
 * so in its header: "One edit per gesture, not one per frame."
 *
 * Without collapsing, a two-second drag is roughly 120 applied changes: it would exhaust a
 * 50-step history in well under a second and undo would stop working on half of what Wave 4
 * built. FR-004a is therefore what makes undo work on the timeline at all, rather than a
 * convenience for arrow keys.
 *
 * Delete `set-timing` from the allow-list in `history/runKey.ts` and this file fails while
 * everything else passes — which is why it is one of T091's negative controls.
 */

const BAR = element({ id: 'bar', startMs: 1000, endMs: 3000 })
const open = () => renderEditor(timelineLesson([BAR]), { timeline: true, ports: fakePorts() })

/** A press, many moves, and a release — the shape `Track` actually emits. */
function dragAcross(node: HTMLElement, steps: number, pxPerStep: number): void {
  act(() => {
    fireEvent.pointerDown(node, { clientX: 0, pointerId: 1 })
    for (let i = 1; i <= steps; i++) {
      fireEvent.pointerMove(node, { clientX: i * pxPerStep, pointerId: 1 })
    }
    fireEvent.pointerUp(node, { clientX: steps * pxPerStep, pointerId: 1 })
  })
}

const timingOf = (session: { draft: { slides: { elements: { id: string; startMs: number }[] }[] } }) =>
  session.draft.slides[0]!.elements.find((e) => e.id === 'bar')!.startMs

describe('a timeline drag is one reversal step', () => {
  it('undoes the whole drag in a single press, however many frames it took', () => {
    const { handle, container } = open()
    const before = timingOf(handle.session)
    const bar = within(container).getByTestId('cs-bar-bar')

    dragAcross(bar, 30, 4)
    expect(timingOf(handle.session)).not.toBe(before)

    act(() => handle.session.undo())
    expect(timingOf(handle.session)).toBe(before)
  })

  it('and leaves nothing else to undo, which is the assertion that would catch 120 steps', () => {
    const { handle, container } = open()
    const bar = within(container).getByTestId('cs-bar-bar')
    dragAcross(bar, 30, 4)

    act(() => handle.session.undo())
    expect(handle.session.canUndo).toBe(false)
  })

  it('two separate drags are two steps, because pointer-up ends the run', () => {
    const { handle, container } = open()
    const bar = within(container).getByTestId('cs-bar-bar')

    dragAcross(bar, 10, 4)
    const afterFirst = timingOf(handle.session)
    dragAcross(bar, 10, 8)
    expect(timingOf(handle.session)).not.toBe(afterFirst)

    act(() => handle.session.undo())
    expect(timingOf(handle.session)).toBe(afterFirst)
  })
})
