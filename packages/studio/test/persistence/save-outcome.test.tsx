import { act } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mountPersistence, tick } from '../harness/persistence.js'
import { lessonWith, element } from '../harness/corpus.js'
import { BACKOFF_MS, IDLE_MS } from '../../src/persistence/schedule.js'

/**
 * `saveNow` says whether the save landed.
 *
 * Feature 009 saves before it publishes, and a publish that proceeded on hope would publish a state
 * storage never held — a version nobody can reproduce, and a record pointing at nothing (FR-018a).
 * So the loop grew a return value, and every reason a save does not land is one publishing must be
 * able to tell apart from a lesson that failed validation.
 *
 * Additive by construction: every existing caller invokes this for its effect and ignores the
 * promise, which the last test here holds to.
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

describe('waiting on a save', () => {
  it('resolves saved once storage has acknowledged it', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)

    let outcome: unknown
    await act(async () => {
      outcome = await handle.persistence.saveNow()
    })
    expect(outcome).toEqual({ ok: true, reason: 'saved' })
    expect(handle.persistence.state.kind).toBe('saved')
  })

  it('resolves nothing-to-save when the draft is already stored', async () => {
    // A success, not a failure: publishing an unchanged draft has everything it needs, and
    // treating "already saved" as an error would fail the commonest state an editor is in.
    const { handle } = mountPersistence(lesson())
    let outcome: unknown
    await act(async () => {
      outcome = await handle.persistence.saveNow()
    })
    expect(outcome).toEqual({ ok: true, reason: 'nothing-to-save' })
  })

  it('resolves offline when storage cannot be reached', async () => {
    const { handle } = mountPersistence(lesson())
    handle.storage.fail('unavailable')
    change(handle, 321)

    let outcome: { ok: boolean; reason?: string } | undefined
    await act(async () => {
      outcome = (await handle.persistence.saveNow()) as never
    })
    expect(outcome).toEqual({ ok: false, reason: 'offline' })
  })

  it('resolves unauthorized when permission is what is missing', async () => {
    const { handle } = mountPersistence(lesson())
    handle.storage.fail('unauthorized')
    change(handle, 321)

    let outcome: { ok: boolean; reason?: string } | undefined
    await act(async () => {
      outcome = (await handle.persistence.saveNow()) as never
    })
    expect(outcome).toEqual({ ok: false, reason: 'unauthorized' })
  })

  it('resolves conflict while one is unanswered, without attempting a save', async () => {
    const { handle } = mountPersistence(lesson(), { openedAt: 'v1' })
    handle.storage.seed('lesson', lesson())
    await handle.storage.clobber(lessonWith([element({ id: 'a', effects: [], width: 777 })]))
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.persistence.conflict).not.toBeNull()
    const attempts = handle.storage.saves.length

    let outcome: { ok: boolean; reason?: string } | undefined
    await act(async () => {
      outcome = (await handle.persistence.saveNow()) as never
    })
    expect(outcome).toEqual({ ok: false, reason: 'conflict' })
    expect(handle.storage.saves.length).toBe(attempts)
  })

  it('distinguishes its three failures, because they send a teacher three different places', async () => {
    const reasons = new Set<string>()
    for (const failure of ['unavailable', 'unauthorized'] as const) {
      const { handle } = mountPersistence(lesson())
      handle.storage.fail(failure)
      change(handle, 321)
      await act(async () => {
        const o = (await handle.persistence.saveNow()) as { reason: string }
        reasons.add(o.reason)
      })
      cleanup()
    }
    expect(reasons.size).toBe(2)
  })
})

describe('the change is additive', () => {
  it('a caller that ignores the promise behaves exactly as before', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    act(() => void handle.persistence.saveNow())
    await tick(handle.scheduler, BACKOFF_MS[0]!)

    expect(handle.storage.saves).toHaveLength(1)
    expect(handle.persistence.state.kind).toBe('saved')
  })
})
