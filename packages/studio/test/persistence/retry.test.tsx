import { act } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mountPersistence, settle, tick } from '../harness/persistence.js'
import { lessonWith, element } from '../harness/corpus.js'
import { BACKOFF_MS, IDLE_MS, MAX_ATTEMPTS } from '../../src/persistence/schedule.js'

/**
 * Failing honestly: five tries, then stop saying you are trying.
 *
 * The requirement with the sharpest edge is the second half. An editor that retries forever
 * is one whose status nobody reads, and a status that says Saving two hours after it gave up
 * is worse than one that says Failed — a teacher acts on it.
 *
 * Three failures are three different problems, too. Unreachable, unauthorized, and a conflict
 * ask the teacher for three different things, and collapsing them into "could not save" tells
 * them none of it (FR-021).
 */
afterEach(cleanup)

const lesson = () => lessonWith([element({ id: 'a', effects: [] })])
const change = (handle: { session: { apply: (e: never) => unknown } }, width: number): void => {
  act(() => void (handle.session.apply as (e: unknown) => unknown)({
    kind: 'set-field',
    id: 'a',
    path: ['width'],
    value: width,
  }))
}

/** Drive every backoff to exhaustion. */
async function exhaust(handle: { scheduler: { advance(ms: number): void } }): Promise<void> {
  for (const delay of BACKOFF_MS) await tick(handle.scheduler as never, delay)
}

describe('an unreachable backend', () => {
  it('reports Offline rather than Saved', async () => {
    const { handle } = mountPersistence(lesson())
    handle.storage.fail('unavailable')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.persistence.state.kind).toBe('offline')
  })

  it('says what is wrong and that the work is safe', async () => {
    const { handle } = mountPersistence(lesson())
    handle.storage.fail('unavailable')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.persistence.state.message).toMatch(/connection returns/i)
  })

  it('retries exactly five times and no more (SC-010c)', async () => {
    const { handle } = mountPersistence(lesson())
    handle.storage.fail('unavailable')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.storage.saves).toHaveLength(1)

    await exhaust(handle)
    expect(handle.storage.saves).toHaveLength(1 + MAX_ATTEMPTS)

    // And nothing further, however long anybody waits.
    await tick(handle.scheduler, 10 * 60 * 1000)
    expect(handle.storage.saves).toHaveLength(1 + MAX_ATTEMPTS)
  })

  it('stops claiming to be trying once they are spent', async () => {
    const { handle } = mountPersistence(lesson())
    handle.storage.fail('unavailable')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    await exhaust(handle)

    expect(handle.persistence.state.kind).toBe('failed')
    expect(handle.persistence.state.attemptsSpent).toBe(true)
  })

  it('succeeds silently if the connection returns mid-backoff', async () => {
    const { handle } = mountPersistence(lesson())
    handle.storage.fail('unavailable')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    handle.storage.fail(null)
    await tick(handle.scheduler, BACKOFF_MS[0]!)
    expect(handle.persistence.state.kind).toBe('saved')
  })
})

describe('permission is not a thing to retry', () => {
  it('fails at once, without five refusals (FR-021)', async () => {
    const { handle } = mountPersistence(lesson())
    handle.storage.fail('unauthorized')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    expect(handle.persistence.state.kind).toBe('failed')
    expect(handle.persistence.state.message).toMatch(/permission/i)

    await tick(handle.scheduler, 10 * 60 * 1000)
    expect(handle.storage.saves).toHaveLength(1)
  })

  it('says something different from the unreachable case', async () => {
    const { handle: a } = mountPersistence(lesson())
    a.storage.fail('unavailable')
    change(a, 321)
    await tick(a.scheduler, IDLE_MS)

    const { handle: b } = mountPersistence(lesson())
    b.storage.fail('unauthorized')
    change(b, 321)
    await tick(b.scheduler, IDLE_MS)

    expect(a.persistence.state.message).not.toBe(b.persistence.state.message)
  })
})

describe('picking it up again', () => {
  it('a further change restarts the automatic attempts (FR-022a)', async () => {
    const { handle } = mountPersistence(lesson())
    handle.storage.fail('unavailable')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    await exhaust(handle)
    const spent = handle.storage.saves.length

    handle.storage.fail(null)
    change(handle, 555)
    await tick(handle.scheduler, IDLE_MS)

    expect(handle.storage.saves.length).toBe(spent + 1)
    expect(handle.persistence.state.kind).toBe('saved')
  })

  it('an explicit retry works too, without waiting for a change', async () => {
    const { handle } = mountPersistence(lesson())
    handle.storage.fail('unavailable')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    await exhaust(handle)

    handle.storage.fail(null)
    await act(async () => {
      handle.persistence.retry()
      await Promise.resolve()
    })
    await settle()
    expect(handle.persistence.state.kind).toBe('saved')
  })
})
