import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { renderEditor } from '../harness/editor.js'
import { element, slide, lessonOf } from '../harness/corpus.js'

/**
 * What history does *not* record, and why that line is where it is.
 *
 * FR-007: session state that is never serialized into the lesson is not a reversal step.
 * The concrete reason rather than the tidy one — an undo that moved the playhead would look
 * like the editor losing its place, and a teacher who scrubbed to 4 seconds and pressed undo
 * expects their last *edit* back, not their last glance.
 *
 * SC-007 measures the same line from the other side: a session of pure navigation leaves the
 * manifest byte-identical to what was loaded.
 */

const lesson = () =>
  lessonOf([
    slide([element({ id: 'a', effects: [] })], { id: 's1' }),
    slide([element({ id: 'b', effects: [] })], { id: 's2' }),
  ])

describe('navigation is not history', () => {
  it('selecting, scrubbing, and changing slides record nothing', () => {
    const { handle } = renderEditor(lesson())
    const before = JSON.stringify(handle.session.draft)

    act(() => handle.session.select(['a']))
    act(() => handle.session.setAuthoringTime(4000))
    act(() => handle.session.goToSlide('s2'))
    act(() => handle.session.select([]))
    act(() => handle.session.goToSlide('s1'))

    expect(handle.session.canUndo).toBe(false)
    expect(JSON.stringify(handle.session.draft)).toBe(before)
  })

  it('undo after pure navigation does nothing at all', () => {
    const { handle } = renderEditor(lesson())
    const before = JSON.stringify(handle.session.draft)
    act(() => handle.session.select(['a']))
    act(() => handle.session.undo())
    expect(JSON.stringify(handle.session.draft)).toBe(before)
  })

  it('a reversal does not restore the authoring time', () => {
    const { handle } = renderEditor(lesson())
    act(() => void handle.session.apply({ kind: 'set-field', id: 'a', path: ['width'], value: 321 }))
    act(() => handle.session.setAuthoringTime(4000))
    act(() => handle.session.undo())
    expect(handle.session.authoringTime).toBe(4000)
  })
})

describe('a refused change is not a change', () => {
  it('records nothing when the reducer says no', () => {
    const { handle } = renderEditor(lesson())
    act(() => void handle.session.apply({ kind: 'delete', ids: ['nonexistent'] }))
    expect(handle.session.lastRefusal).not.toBeNull()
    expect(handle.session.canUndo).toBe(false)
  })

  it('a locked element refused mid-run leaves the run intact', () => {
    const { handle } = renderEditor(lesson())
    act(() => void handle.session.apply({ kind: 'set-flag', ids: ['a'], flag: 'locked', value: true }))
    const afterLock = JSON.stringify(handle.session.draft)
    act(() => void handle.session.apply({ kind: 'transform-elements', ids: ['a'], geometry: { x: 400 } }))
    expect(handle.session.draft).toEqual(JSON.parse(afterLock))
    // One step — the lock — and not a phantom second one for the refusal.
    act(() => handle.session.undo())
    expect(handle.session.canUndo).toBe(false)
  })
})

describe('redo is discarded by a new change', () => {
  it('offers nothing to redo once the teacher does something else', () => {
    const { handle } = renderEditor(lesson())
    act(() => void handle.session.apply({ kind: 'set-field', id: 'a', path: ['width'], value: 321 }))
    act(() => handle.session.undo())
    expect(handle.session.canRedo).toBe(true)

    act(() => void handle.session.apply({ kind: 'set-field', id: 'a', path: ['height'], value: 55 }))
    expect(handle.session.canRedo).toBe(false)
  })
})
