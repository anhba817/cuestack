import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { renderEditor } from '../harness/editor.js'
import { element, slide, lessonOf } from '../harness/corpus.js'

/**
 * A reversal a teacher can see.
 *
 * FR-008 and FR-009 exist because a correct undo that shows nothing reads as a broken one.
 * Undo an edit made on another slide and the editor goes there; undo a deletion and what came
 * back is selected, so the teacher's eye lands on the thing that changed.
 *
 * The selection rule is *computed*, not recorded: `EditResult` carries `idsCreated` and
 * nothing about removals, so knowing what a delete took would mean a branch per edit kind —
 * which Constitution I calls a defect. Diffing element ids on the affected slide is general.
 */

const twoSlides = () =>
  lessonOf([
    slide([element({ id: 'first', effects: [] }), element({ id: 'second', effects: [] })], { id: 's1' }),
    slide([element({ id: 'far', effects: [] })], { id: 's2' }),
  ])

describe('undo brings the change into view', () => {
  it('navigates to the slide the change was made on', () => {
    const { handle } = renderEditor(twoSlides())
    act(() => void handle.session.apply({ kind: 'delete', ids: ['second'] }))
    act(() => handle.session.goToSlide('s2'))
    expect(handle.session.slideId).toBe('s2')

    act(() => handle.session.undo())
    expect(handle.session.slideId).toBe('s1')
  })

  it('stays put when the change was on the slide already showing', () => {
    const { handle } = renderEditor(twoSlides())
    act(() => void handle.session.apply({ kind: 'delete', ids: ['second'] }))
    act(() => handle.session.undo())
    expect(handle.session.slideId).toBe('s1')
  })
})

describe('undo selects what came back', () => {
  it('selects a deleted element on its return', () => {
    const { handle } = renderEditor(twoSlides())
    act(() => handle.session.select(['first']))
    act(() => void handle.session.apply({ kind: 'delete', ids: ['second'] }))

    act(() => handle.session.undo())
    expect(handle.session.selection).toEqual(['second'])
  })

  it('selects all of a multiple deletion', () => {
    const { handle } = renderEditor(twoSlides())
    act(() => void handle.session.apply({ kind: 'delete', ids: ['first', 'second'] }))
    act(() => handle.session.undo())
    expect([...handle.session.selection].sort()).toEqual(['first', 'second'])
  })

  it('falls back to the selection the teacher had when nothing was restored', () => {
    // Undoing an *add* restores no element, so there is nothing to point at. The useful
    // answer is where the teacher was before they added.
    const { handle } = renderEditor(twoSlides())
    act(() => handle.session.select(['first']))
    act(() => void handle.session.apply({ kind: 'add-element', type: 'text' }))
    act(() => handle.session.undo())
    expect(handle.session.selection).toEqual(['first'])
  })

  it('never leaves an id in the selection that the draft does not hold', () => {
    // The invariant feature 005 established, restated across a reversal: a selection naming a
    // ghost is how a later nudge addresses an element that is not there.
    const { handle } = renderEditor(twoSlides())
    act(() => void handle.session.apply({ kind: 'add-element', type: 'text' }))
    const created = handle.session.draft.slides[0]!.elements.map((e) => e.id)
    act(() => handle.session.select([created[created.length - 1]!]))
    act(() => handle.session.undo())

    const present = new Set(handle.session.draft.slides.flatMap((s) => s.elements.map((e) => e.id)))
    for (const id of handle.session.selection) expect(present.has(id)).toBe(true)
  })
})
