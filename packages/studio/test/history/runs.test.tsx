import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { renderEditor } from '../harness/editor.js'
import { lessonWith, element } from '../harness/corpus.js'

/**
 * What counts as one thing a teacher did.
 *
 * FR-004a, and the rule is grouping by *sameness* rather than by elapsed time. That keeps
 * history deterministic — the same sequence of actions produces the same history whatever
 * speed it was performed at — and it is why no test in this file needs a clock.
 */

const lesson = () => lessonWith([element({ id: 'a', effects: [] }), element({ id: 'b', effects: [] })])

const nudge = (session: { apply: (e: never) => unknown }, id: string, x: number): void => {
  act(() => void (session.apply as (e: unknown) => unknown)({
    kind: 'transform-elements',
    ids: [id],
    geometry: { x },
  }))
}

describe('a run of the same change is one reversal step', () => {
  it('ten nudges of one element undo in a single press', () => {
    const { handle } = renderEditor(lesson())
    const start = JSON.stringify(handle.session.draft)
    // Offsets that never land back on the fixture's default x of 100: a run whose last value
    // happened to equal the first would make this assert nothing.
    for (let i = 1; i <= 10; i++) nudge(handle.session, 'a', 200 + i * 10)
    expect(JSON.stringify(handle.session.draft)).not.toBe(start)

    act(() => handle.session.undo())
    expect(JSON.stringify(handle.session.draft)).toBe(start)
    expect(handle.session.canUndo).toBe(false)
  })

  it('a selection change between nudges splits them into two steps', () => {
    const { handle } = renderEditor(lesson())
    nudge(handle.session, 'a', 310)
    act(() => handle.session.select(['b']))
    nudge(handle.session, 'a', 420)

    act(() => handle.session.undo())
    expect(handle.session.canUndo).toBe(true)
  })

  it('endEditRun splits two drags of the same element', () => {
    // Without this a second drag would join the first, and one undo would put the element
    // back where it was two drags ago. Pointer-up is the boundary a teacher already believes
    // in, and it is not elapsed time.
    const { handle } = renderEditor(lesson())
    nudge(handle.session, 'a', 310)
    act(() => handle.session.endEditRun())
    nudge(handle.session, 'a', 420)

    act(() => handle.session.undo())
    const el = handle.session.draft.slides[0]!.elements.find((e) => e.id === 'a')!
    expect(el.x).toBe(310)
  })

  it('a different element starts a new run even with no boundary', () => {
    const { handle } = renderEditor(lesson())
    nudge(handle.session, 'a', 350)
    nudge(handle.session, 'b', 350)
    act(() => handle.session.undo())
    expect(handle.session.canUndo).toBe(true)
  })

  it('two fields on one element are two runs, not one', () => {
    // The path is in the run key for exactly this. `set-field` addresses an element rather
    // than a field, and the inspector commits on every `onChange`, so without the path a
    // teacher who set a width and then typed a label would lose both to one undo.
    const { handle } = renderEditor(lesson())
    act(() => void handle.session.apply({ kind: 'set-field', id: 'a', path: ['width'], value: 321 }))
    act(() => void handle.session.apply({ kind: 'set-field', id: 'a', path: ['height'], value: 222 }))

    act(() => handle.session.undo())
    const el = handle.session.draft.slides[0]!.elements.find((e) => e.id === 'a')!
    expect(el.width).toBe(321)
    expect(el.height).not.toBe(222)
  })

  it('a run of one field collapses however many keystrokes it took', () => {
    const { handle } = renderEditor(lesson())
    const start = JSON.stringify(handle.session.draft)
    for (const value of [1, 12, 123, 1234]) {
      act(() => void handle.session.apply({ kind: 'set-field', id: 'a', path: ['width'], value }))
    }
    act(() => handle.session.undo())
    expect(JSON.stringify(handle.session.draft)).toBe(start)
  })

  it('a delete never joins the run above it', () => {
    // Only four kinds collapse. Everything else gets a key that cannot match, so a deletion
    // after a drag is always its own step no matter what preceded it.
    const { handle } = renderEditor(lesson())
    nudge(handle.session, 'a', 350)
    act(() => void handle.session.apply({ kind: 'delete', ids: ['b'] }))
    act(() => handle.session.undo())
    expect(handle.session.draft.slides[0]!.elements).toHaveLength(2)
    expect(handle.session.canUndo).toBe(true)
  })
})
