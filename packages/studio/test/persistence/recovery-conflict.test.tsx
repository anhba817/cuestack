import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useDraftRecovery, type DraftRecovery } from '../../src/persistence/useDraftRecovery.js'
import { mountPersistence, tick } from '../harness/persistence.js'
import { recordingStorage } from '../harness/storage.js'
import { spyKeeper } from '../harness/keeper.js'
import { keyFor } from '../../src/persistence/keeper.js'
import { lessonWith, element } from '../harness/corpus.js'
import { IDLE_MS } from '../../src/persistence/schedule.js'

/**
 * Where US3 meets US4, which is the case nobody was looking at.
 *
 * A teacher's connection drops, work is kept, and while they are away somebody else saves the
 * lesson. Reopening, they are choosing between two versions rather than recovering from an
 * interruption — so the offer says so (FR-027b) — and restoring produces a conflict on the
 * first save.
 *
 * **The point of this file is that no third path was invented.** The blocking recovery prompt
 * and the non-blocking conflict notice compose: recovery is answered before there is a lesson
 * on screen, the conflict arrives once there is one. A design that blocked on both, or on
 * neither, would have needed a special case here (research R-15, R-16).
 */
afterEach(cleanup)

const at = (width: number) => lessonWith([element({ id: 'a', effects: [], width })])

function reopen(storage: ReturnType<typeof recordingStorage>, keeper: ReturnType<typeof spyKeeper>) {
  const holder = { recovery: undefined as unknown as DraftRecovery }
  function Harness(): React.ReactNode {
    holder.recovery = useDraftRecovery({ storage, lessonId: 'lesson', identity: 'teacher', keeper })
    return null
  }
  render(<Harness />)
  return holder
}

const settle = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('kept work, and a lesson somebody else has since saved', () => {
  async function setup() {
    const storage = recordingStorage()
    storage.seed('lesson', at(100))
    // A colleague saves while this teacher is away.
    await storage.clobber(at(777))

    const keeper = spyKeeper()
    keeper.write(
      keyFor('teacher', 'lesson'),
      JSON.stringify({ lessonId: 'lesson', manifest: at(321), token: 'v1' }),
    )
    return { storage, keeper }
  }

  it('offers the kept work, and says the lesson has changed (FR-027b)', async () => {
    const { storage, keeper } = await setup()
    const holder = reopen(storage, keeper)
    await settle()

    expect(holder.recovery.status).toBe('offer')
    expect(holder.recovery.movedOn).toBe(true)
  })

  it('restoring proceeds, and the first save afterwards conflicts', async () => {
    const { storage, keeper } = await setup()
    const holder = reopen(storage, keeper)
    await settle()
    act(() => holder.recovery.restoreKept())
    const recovered = holder.recovery.manifest!
    expect(recovered.slides[0]!.elements[0]!.width).toBe(321)
    cleanup()

    // The editor opens with the recovered work, built on the token it was kept against.
    const { handle } = mountPersistence(recovered, { storage, openedAt: 'v1', identity: 'teacher' })
    act(() => void handle.session.apply({ kind: 'set-field', id: 'a', path: ['width'], value: 400 }))
    await tick(handle.scheduler, IDLE_MS)

    expect(handle.persistence.conflict).not.toBeNull()
  })

  it('and it is the ordinary conflict — the same notice, the same two ways forward', async () => {
    const { storage, keeper } = await setup()
    const holder = reopen(storage, keeper)
    await settle()
    act(() => holder.recovery.restoreKept())
    const recovered = holder.recovery.manifest!
    cleanup()

    const { handle } = mountPersistence(recovered, { storage, openedAt: 'v1', identity: 'teacher' })
    act(() => void handle.session.apply({ kind: 'set-field', id: 'a', path: ['width'], value: 400 }))
    await tick(handle.scheduler, IDLE_MS)

    // No third mechanism: the conflict carries the current token, autosave has stopped, and
    // both resolutions are the ones US4 already built.
    expect(handle.persistence.conflict?.currentToken).toBeTruthy()
    expect(handle.persistence.state.kind).toBe('failed')
    expect(typeof handle.persistence.takeStored).toBe('function')
    expect(typeof handle.persistence.keepMine).toBe('function')
  })

  it('keeping mine then saves forward, leaving their version in the history', async () => {
    const { storage, keeper } = await setup()
    const holder = reopen(storage, keeper)
    await settle()
    act(() => holder.recovery.restoreKept())
    const recovered = holder.recovery.manifest!
    cleanup()

    const { handle } = mountPersistence(recovered, { storage, openedAt: 'v1', identity: 'teacher' })
    act(() => void handle.session.apply({ kind: 'set-field', id: 'a', path: ['width'], value: 400 }))
    await tick(handle.scheduler, IDLE_MS)

    act(() => handle.persistence.keepMine())
    await tick(handle.scheduler, IDLE_MS)
    await settle()

    expect(handle.persistence.conflict).toBeNull()
    expect(handle.persistence.state.kind).toBe('saved')
  })

  it('discarding the kept work opens their version with no conflict at all', async () => {
    const { storage, keeper } = await setup()
    const holder = reopen(storage, keeper)
    await settle()
    act(() => holder.recovery.discardKept())

    expect(holder.recovery.manifest?.slides[0]!.elements[0]!.width).toBe(777)
    expect(holder.recovery.status).toBe('ready')
  })
})
