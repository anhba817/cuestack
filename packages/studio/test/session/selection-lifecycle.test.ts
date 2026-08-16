import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * T082 — data-model.md §2, invariant 1, from the deletion side.
 *
 * This is the deletion-specific case of the invariant `session.test.ts` asserts generally, and
 * the overlap is deliberate: deletion is the only operation that can break it from the *draft*
 * side rather than the selection side. Everything else changes the selection to something that
 * exists; a delete changes what exists underneath a selection that was already valid.
 *
 * If it were left broken, every consumer downstream would have to handle an id with no
 * element, and one of them would forget.
 */
function session(elements = [element(), element(), element()]) {
  const lesson = lessonWith(elements)
  const idSource = countingIds()
  return renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource }),
  )
}

describe('the selection never outlives its elements', () => {
  it('drops a deleted element from the selection in the same edit', () => {
    const { result } = session()
    const ids = result.current.draft.slides[0]!.elements.map((e) => e.id)

    act(() => result.current.select(ids))
    act(() => void result.current.apply({ kind: 'delete', ids: [ids[1]!] }))

    expect(result.current.selection).toEqual([ids[0], ids[2]])
  })

  it('empties the selection when everything selected is deleted', () => {
    const { result } = session()
    const ids = result.current.draft.slides[0]!.elements.map((e) => e.id)

    act(() => result.current.select(ids))
    act(() => void result.current.apply({ kind: 'delete', ids }))

    expect(result.current.selection).toEqual([])
    expect(result.current.draft.slides[0]!.elements).toHaveLength(0)
  })

  it('holds only ids that exist, after any edit', () => {
    const { result } = session()
    const ids = result.current.draft.slides[0]!.elements.map((e) => e.id)
    act(() => result.current.select(ids))

    act(() => void result.current.apply({ kind: 'delete', ids: [ids[0]!] }))
    act(() => void result.current.apply({ kind: 'duplicate', ids: [ids[1]!] }))

    const present = new Set(result.current.draft.slides[0]!.elements.map((e) => e.id))
    for (const id of result.current.selection) expect(present.has(id)).toBe(true)
  })

  it('leaves the selection alone when an unrelated element is deleted', () => {
    const { result } = session()
    const ids = result.current.draft.slides[0]!.elements.map((e) => e.id)

    act(() => result.current.select([ids[0]!]))
    act(() => void result.current.apply({ kind: 'delete', ids: [ids[2]!] }))

    expect(result.current.selection).toEqual([ids[0]])
  })

  it('keeps a duplicate’s source selected — duplicating does not move the selection', () => {
    const { result } = session()
    const ids = result.current.draft.slides[0]!.elements.map((e) => e.id)

    act(() => result.current.select([ids[0]!]))
    act(() => void result.current.apply({ kind: 'duplicate', ids: [ids[0]!] }))

    expect(result.current.selection).toEqual([ids[0]])
  })
})
