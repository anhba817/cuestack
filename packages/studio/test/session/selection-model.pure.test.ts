import { describe, expect, it } from 'vitest'
import { add, clampSelection, clear, replace, toggle } from '../../src/session/selection.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * T032 — FR-001, FR-002, FR-008.
 *
 * Named `*.pure.test.ts`, which puts it in the node project where there is no `document`.
 * Selection is algebra, not interaction: what a modifier-click *means* is decidable without
 * a browser, and keeping it that way is what stops the multi-select logic from becoming
 * reachable only through a pointer event (research R-04).
 */
describe('selection algebra', () => {
  it('runs with no DOM', () => {
    expect(typeof globalThis.document).toBe('undefined')
  })

  it('replaces the selection outright', () => {
    expect(replace(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('adds an unselected element on toggle', () => {
    expect(toggle(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('removes an already-selected element on toggle — modifier-click both ways', () => {
    expect(toggle(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  it('accumulates without removing, for a marquee sweeping over a live selection', () => {
    expect(add(['a'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
    expect(add(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('clears to empty, which means the slide is selected', () => {
    expect(clear()).toEqual([])
  })

  it('preserves order — the first thing clicked stays first', () => {
    expect(add(['c'], ['a', 'b'])).toEqual(['c', 'a', 'b'])
  })

  it('never holds the same id twice', () => {
    expect(replace(['a', 'a', 'b'])).toEqual(['a', 'b'])
    expect(add(['a'], ['a'])).toEqual(['a'])
  })
})

describe('clampSelection', () => {
  it('drops ids that are not on the slide (invariant 1)', () => {
    const draft = lessonWith([element(), element()])
    const [first, second] = draft.slides[0]!.elements
    const kept = clampSelection([first!.id, 'gone', second!.id], draft, draft.slides[0]!.id)
    expect(kept).toEqual([first!.id, second!.id])
  })

  it('keeps a locked element selectable — locking guards transforms, not selection (BR-011)', () => {
    const draft = lessonWith([element({ locked: true })])
    const id = draft.slides[0]!.elements[0]!.id
    expect(clampSelection([id], draft, draft.slides[0]!.id)).toEqual([id])
  })

  it('keeps a hidden element selectable — it is still in the draft (BR-010)', () => {
    const draft = lessonWith([element({ hidden: true })])
    const id = draft.slides[0]!.elements[0]!.id
    expect(clampSelection([id], draft, draft.slides[0]!.id)).toEqual([id])
  })

  it('empties a selection when the slide has nothing on it', () => {
    const draft = lessonWith([])
    expect(clampSelection(['a', 'b'], draft, draft.slides[0]!.id)).toEqual([])
  })
})
