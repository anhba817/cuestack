import { act } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mountPersistence, settle, tick } from '../harness/persistence.js'
import { lessonWith, element } from '../harness/corpus.js'
import { IDLE_MS } from '../../src/persistence/schedule.js'

/**
 * Undo is a change, and it is never an unsave.
 *
 * FR-013 in two halves. A reversal produces a new state, so it saves like any other change —
 * an editor that reported Saved after an undo would be claiming storage holds something it
 * does not. And it removes nothing: no acknowledged version disappears and no checkpoint is
 * withdrawn, because undo is about the lesson and saving is about the record of it.
 *
 * The whole file depends on US1's history, which is why it lives in Phase 4 and not earlier.
 */
afterEach(cleanup)

const lesson = () => lessonWith([element({ id: 'a', effects: [], width: 100 })])
const width = (handle: { session: { draft: { slides: { elements: { width: number }[] }[] } } }) =>
  handle.session.draft.slides[0]!.elements[0]!.width
const change = (handle: { session: { apply: (e: never) => unknown } }, value: number): void => {
  act(() => void (handle.session.apply as (e: unknown) => unknown)({
    kind: 'set-field',
    id: 'a',
    path: ['width'],
    value,
  }))
}

describe('a reversal saves', () => {
  it('sends the reverted lesson after the interval', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.storage.saves).toHaveLength(1)

    act(() => handle.session.undo())
    await tick(handle.scheduler, IDLE_MS)

    expect(handle.storage.saves).toHaveLength(2)
    expect(handle.storage.saves[1]!.manifest.slides[0]!.elements[0]!.width).toBe(100)
  })

  it('so the stored lesson matches what the teacher is looking at (SC-006a)', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    act(() => handle.session.undo())
    await tick(handle.scheduler, IDLE_MS)
    await settle()

    const loaded = await handle.storage.loadDraft('lesson')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.manifest.slides[0]!.elements[0]!.width).toBe(width(handle))
  })

  it('and a redo saves too', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    act(() => handle.session.undo())
    await tick(handle.scheduler, IDLE_MS)
    act(() => handle.session.redo())
    await tick(handle.scheduler, IDLE_MS)

    expect(handle.storage.saves).toHaveLength(3)
    expect(handle.storage.saves[2]!.manifest.slides[0]!.elements[0]!.width).toBe(321)
  })

  it('reports Saving while it does, not Saved', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    act(() => handle.session.undo())
    expect(handle.persistence.state.kind).toBe('pending')
  })
})

describe('a reversal is not an unsave', () => {
  it('removes no checkpoint that was already recorded', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    const before = (await handle.storage.listVersions('lesson')).length
    expect(before).toBeGreaterThan(0)

    act(() => handle.session.undo())
    await tick(handle.scheduler, IDLE_MS)
    await settle()

    const after = (await handle.storage.listVersions('lesson')).length
    expect(after).toBeGreaterThanOrEqual(before)
  })

  it('does not rewind the version the editor holds', async () => {
    // Undoing the lesson does not undo the record of it: the token only ever moves forward,
    // which is what keeps conflict detection meaningful across a reversal.
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    const afterSave = handle.persistence.token

    act(() => handle.session.undo())
    await tick(handle.scheduler, IDLE_MS)
    await settle()

    expect(handle.persistence.token).not.toBe(afterSave)
    expect(handle.persistence.state.kind).toBe('saved')
  })
})
