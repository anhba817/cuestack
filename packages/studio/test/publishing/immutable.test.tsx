import { act } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { attemptPublish, mountPublishing, resolvingAssets } from '../harness/publishing.js'
import { lessonWith, element } from '../harness/corpus.js'

afterEach(cleanup)

const lesson = () =>
  lessonWith([
    element({ id: 'a', effects: [], payload: { text: 'Hello' } }),
    element({ id: 'b', effects: [], payload: { text: 'World' } }),
  ])

/**
 * SC-003 through the editor: the same property BR-009 asserts in core, exercised the way a teacher
 * reaches it — by publishing and then working.
 *
 * The second half (FR-036) is the direction that is easy to miss. Publishing runs a save, so it
 * touches the draft, the history, and the save state; a *successful* publish must still leave all
 * three exactly as they were. The refusal path is covered in `refusals.test.tsx`; this is the one
 * where something did happen.
 */
describe('publishing and then editing', () => {
  it('leaves the published version byte-identical through add, delete, undo, and restore', async () => {
    const { handle } = mountPublishing(lesson(), { assets: resolvingAssets() })
    const outcome = await attemptPublish(handle)
    expect(outcome.ok).toBe(true)

    const first = await handle.adapter.loadPublished('lesson')
    if (!first.ok) throw new Error('unreachable')
    const asPublished = JSON.stringify(first.version.manifest)

    act(() => void handle.session.apply({ kind: 'add-element', type: 'text' }))
    act(() => void handle.session.apply({ kind: 'delete', ids: ['b'] }))
    act(() => handle.session.undo())
    act(() => handle.session.redo())
    act(() =>
      void handle.session.apply({
        kind: 'set-field',
        id: 'a',
        path: ['payload', 'text'],
        value: 'Rewritten entirely',
      }),
    )

    const again = await handle.adapter.loadPublished('lesson')
    if (!again.ok) throw new Error('unreachable')
    expect(JSON.stringify(again.version.manifest)).toBe(asPublished)
  })

  it('a successful publish leaves the draft, the history, and the save state as they were', async () => {
    const { handle } = mountPublishing(lesson(), { assets: resolvingAssets() })

    act(() =>
      void handle.session.apply({
        kind: 'set-field',
        id: 'a',
        path: ['payload', 'text'],
        value: 'Edited',
      }),
    )

    const draftBefore = JSON.stringify(handle.session.draft)
    const couldUndo = handle.session.canUndo
    const couldRedo = handle.session.canRedo

    const outcome = await attemptPublish(handle)
    expect(outcome.ok).toBe(true)

    expect(JSON.stringify(handle.session.draft)).toBe(draftBefore)
    // Publishing is not an edit, so it neither adds a step nor spends one.
    expect(handle.session.canUndo).toBe(couldUndo)
    expect(handle.session.canRedo).toBe(couldRedo)
    // And the save it ran is a save, so the lesson reads as saved rather than as anything new.
    expect(handle.persistence.state.kind).toBe('saved')
  })

  it('publishes what was saved, not what was in flight', async () => {
    /**
     * FR-018a. The version stored must equal the draft at the moment of publishing, or the
     * published lesson is a state nobody can reproduce from the editor.
     */
    const { handle } = mountPublishing(lesson(), { assets: resolvingAssets() })
    act(() =>
      void handle.session.apply({
        kind: 'set-field',
        id: 'a',
        path: ['payload', 'text'],
        value: 'Final wording',
      }),
    )

    await attemptPublish(handle)

    const loaded = await handle.adapter.loadPublished('lesson')
    if (!loaded.ok) throw new Error('unreachable')
    expect(loaded.version.manifest.slides[0]!.elements[0]!.payload).toEqual({
      text: 'Final wording',
    })
    expect(handle.storage.saves.at(-1)!.manifest.slides[0]!.elements[0]!.payload).toEqual({
      text: 'Final wording',
    })
  })
})
