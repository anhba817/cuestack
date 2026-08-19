import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { renderEditor } from '../harness/editor.js'
import { lessonWith, element } from '../harness/corpus.js'

/**
 * Reading a lesson cannot change it, undo included.
 *
 * The refusal comes from the same place every other one does — a reversal *is* an ordinary
 * change to the draft, so `mode` is checked once rather than twice. Nothing is recorded in
 * read-only either, because nothing there succeeds, so `canUndo` never becomes true.
 */
const lesson = () => lessonWith([element({ id: 'a', effects: [] })])

describe('read-only refuses reversals', () => {
  it('undo changes nothing and says why', () => {
    const { handle } = renderEditor(lesson(), { mode: 'read-only' })
    const before = JSON.stringify(handle.session.draft)

    act(() => handle.session.undo())
    expect(JSON.stringify(handle.session.draft)).toBe(before)
    expect(handle.session.lastRefusal?.reason).toBe('read-only')
  })

  it('redo is refused the same way', () => {
    const { handle } = renderEditor(lesson(), { mode: 'read-only' })
    act(() => handle.session.redo())
    expect(handle.session.lastRefusal?.reason).toBe('read-only')
  })

  it('the refusal names copying as the thing that is still permitted', () => {
    // NFR-USA-004: the problem, the object, and the recommended action. A teacher told only
    // "not allowed" learns nothing about what they can do instead.
    const { handle } = renderEditor(lesson(), { mode: 'read-only' })
    act(() => handle.session.undo())
    expect(handle.session.lastRefusal?.message).toMatch(/copying is still permitted/i)
  })

  it('records nothing, so there is never anything to undo', () => {
    const { handle } = renderEditor(lesson(), { mode: 'read-only' })
    act(() => void handle.session.apply({ kind: 'delete', ids: ['a'] }))
    expect(handle.session.canUndo).toBe(false)
    expect(handle.session.canRedo).toBe(false)
  })
})
