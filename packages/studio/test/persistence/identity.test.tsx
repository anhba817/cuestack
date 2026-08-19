import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useDraftRecovery, type DraftRecovery } from '../../src/persistence/useDraftRecovery.js'
import { mountPersistence, tick } from '../harness/persistence.js'
import { nothingDurableWritten } from '../harness/keeper.js'
import { recordingStorage } from '../harness/storage.js'
import { keyFor, keeperFor } from '../../src/persistence/keeper.js'
import { lessonWith, element } from '../harness/corpus.js'
import { IDLE_MS } from '../../src/persistence/schedule.js'

/**
 * One teacher's unsaved lesson is not the next person's to read.
 *
 * Teachers work on shared classroom and staffroom machines, and a draft kept in the browser
 * for recovery is a draft sitting there for whoever opens it next. So kept work is scoped per
 * lesson **and** per author, and — the part that makes it a guarantee rather than a policy —
 * **the absence of an identity selects the in-memory keeper**. Nothing durable is written, so
 * there is nothing to leak, rather than something the editor declines to mention.
 *
 * `nothingDurableWritten` asserts exactly that: not "no offer appeared" but "localStorage was
 * never touched". The first would pass against an implementation that wrote the draft to a
 * shared machine and then kept quiet about it.
 */
afterEach(cleanup)
beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear()
})

const lesson = () => lessonWith([element({ id: 'a', effects: [] })])
const change = (handle: { session: { apply: (e: never) => unknown } }, width: number): void => {
  act(() => void (handle.session.apply as (e: unknown) => unknown)({
    kind: 'set-field',
    id: 'a',
    path: ['width'],
    value: width,
  }))
}

function openFor(identity: string | undefined, storage: ReturnType<typeof recordingStorage>) {
  const holder = { recovery: undefined as unknown as DraftRecovery }
  function Harness(): React.ReactNode {
    holder.recovery = useDraftRecovery({
      storage,
      lessonId: 'lesson',
      ...(identity !== undefined ? { identity } : {}),
    })
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

describe('kept work is scoped to the person who made it', () => {
  it('the key names both the lesson and the author', () => {
    expect(keyFor('teacher-a', 'lesson-1')).not.toBe(keyFor('teacher-b', 'lesson-1'))
    expect(keyFor('teacher-a', 'lesson-1')).not.toBe(keyFor('teacher-a', 'lesson-2'))
  })

  it('is not offered to a different teacher at the same browser', async () => {
    const storage = recordingStorage()
    storage.seed('lesson', lesson())
    // One teacher leaves work behind, durably.
    keeperFor('teacher-a').write(
      keyFor('teacher-a', 'lesson'),
      JSON.stringify({ lessonId: 'lesson', manifest: lesson(), token: 'v1' }),
    )

    const theirs = openFor('teacher-a', storage)
    await settle()
    expect(theirs.recovery.status).toBe('offer')
    cleanup()

    const somebodyElse = openFor('teacher-b', storage)
    await settle()
    expect(somebodyElse.recovery.status).toBe('ready')
  })

  it('is not offered for a different lesson either', async () => {
    const storage = recordingStorage()
    storage.seed('lesson', lesson())
    keeperFor('teacher-a').write(
      keyFor('teacher-a', 'another-lesson'),
      JSON.stringify({ lessonId: 'another-lesson', manifest: lesson(), token: 'v1' }),
    )

    const holder = openFor('teacher-a', storage)
    await settle()
    expect(holder.recovery.status).toBe('ready')
  })
})

describe('with no author identity', () => {
  it('writes nothing durable at all (FR-029a)', async () => {
    const { handle } = mountPersistence(lesson(), { keeper: undefined as never, identity: undefined })
    handle.storage.fail('unavailable')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    // Not "nothing was offered" — nothing was written. Failing closed here costs a
    // convenience; failing open would leak a draft.
    nothingDurableWritten()
  })

  it('still resends within the session, so an interruption costs nothing', async () => {
    const { handle } = mountPersistence(lesson(), { identity: undefined })
    handle.storage.fail('unavailable')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.persistence.state.kind).toBe('offline')

    handle.storage.fail(null)
    await tick(handle.scheduler, 1_000)
    expect(handle.persistence.state.kind).toBe('saved')
  })

  it('offers nothing on reopening, because there is nothing to offer', async () => {
    const storage = recordingStorage()
    storage.seed('lesson', lesson())
    const holder = openFor(undefined, storage)
    await settle()
    expect(holder.recovery.status).toBe('ready')
  })
})

describe('the identity goes nowhere else (FR-029b)', () => {
  it('never reaches the manifest or a save payload', async () => {
    const { handle } = mountPersistence(lesson(), { identity: 'teacher-a' })
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    const sent = JSON.stringify(handle.storage.saves[0]!.manifest)
    expect(sent).not.toContain('teacher-a')
    expect(JSON.stringify(handle.session.draft)).not.toContain('teacher-a')
  })
})
