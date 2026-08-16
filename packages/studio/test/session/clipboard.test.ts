import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useEditorSession } from '../../src/session/useEditorSession.js'
import { EDIT_KINDS } from '../../src/draft/edit.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * T080 — FR-032, FR-051, SC-007.
 *
 * Copy is the entry that most looks like an edit and is not. It writes to
 * `session.clipboard` and changes no authored data, so it never reaches the reducer — and the
 * consequence is the pair asserted at the end of this file: **read-only permits copying and
 * refuses pasting.** The reducer cannot assert that, because copy never arrives there.
 */
function session(elements = [element({ payload: { text: 'original' } })], mode: 'edit' | 'read-only' = 'edit') {
  const lesson = lessonWith(elements)
  const idSource = countingIds()
  return renderHook(() =>
    useEditorSession({ manifest: lesson, slideId: lesson.slides[0]!.id, idSource, mode }),
  )
}

describe('copy', () => {
  it('starts empty', () => {
    const { result } = session()
    expect(result.current.clipboard).toEqual([])
  })

  it('captures the named elements', () => {
    const { result } = session([element(), element()])
    const ids = result.current.draft.slides[0]!.elements.map((e) => e.id)

    act(() => result.current.copy([ids[0]!]))

    expect(result.current.clipboard).toHaveLength(1)
    expect(result.current.clipboard[0]!.id).toBe(ids[0])
  })

  it('is not an `Edit` — the union does not contain it', () => {
    expect(EDIT_KINDS).not.toContain('copy')
  })

  it('leaves the manifest byte-identical (SC-007)', () => {
    const { result } = session()
    const before = JSON.stringify(result.current.draft)
    const id = result.current.draft.slides[0]!.elements[0]!.id

    act(() => result.current.copy([id]))

    expect(JSON.stringify(result.current.draft)).toBe(before)
  })

  /**
   * Detached, so the clipboard is a snapshot rather than a window.
   *
   * A teacher who copies, edits the original, then pastes expects the copy they took — not
   * whatever the source has become. Holding a reference would also let a delete leave the
   * clipboard pointing at something that no longer exists.
   */
  it('takes a detached copy — editing the source afterwards does not change what pastes', () => {
    const { result } = session()
    const id = result.current.draft.slides[0]!.elements[0]!.id

    act(() => result.current.copy([id]))
    act(() => void result.current.apply({ kind: 'set-text', id, text: 'changed since' }))

    expect((result.current.clipboard[0]!.payload as { text: string }).text).toBe('original')
  })

  it('survives the source being deleted', () => {
    const { result } = session()
    const id = result.current.draft.slides[0]!.elements[0]!.id

    act(() => result.current.copy([id]))
    act(() => void result.current.apply({ kind: 'delete', ids: [id] }))

    expect(result.current.draft.slides[0]!.elements).toHaveLength(0)
    expect(result.current.clipboard).toHaveLength(1)

    act(() => void result.current.apply({ kind: 'paste', elements: result.current.clipboard }))
    expect(result.current.draft.slides[0]!.elements).toHaveLength(1)
  })
})

describe('read-only splits copy from paste (FR-051)', () => {
  it('permits copying — it changes nothing', () => {
    const { result } = session([element()], 'read-only')
    const id = result.current.draft.slides[0]!.elements[0]!.id

    act(() => result.current.copy([id]))

    expect(result.current.clipboard).toHaveLength(1)
  })

  it('refuses pasting, like every other edit', () => {
    const { result } = session([element()], 'read-only')
    const id = result.current.draft.slides[0]!.elements[0]!.id
    act(() => result.current.copy([id]))

    act(() => void result.current.apply({ kind: 'paste', elements: result.current.clipboard }))

    expect(result.current.lastRefusal?.reason).toBe('read-only')
    expect(result.current.draft.slides[0]!.elements).toHaveLength(1)
  })
})
