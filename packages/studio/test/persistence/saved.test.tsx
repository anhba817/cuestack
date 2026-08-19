import { act } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mountPersistence, settle, tick } from '../harness/persistence.js'
import { lessonWith, element } from '../harness/corpus.js'
import { IDLE_MS } from '../../src/persistence/schedule.js'

/**
 * Saved means storage said so.
 *
 * FR-017 is the promise a teacher stakes an hour of work on, and the only way to test it is
 * to refuse to acknowledge: the recording storage holds the acknowledgement open, and the
 * status must sit at Saving for as long as that lasts. An editor that says Saved when it has
 * merely *sent* the work is telling a comfortable lie at precisely the moment the truth
 * matters.
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

describe('Saved is never said early', () => {
  it('stays at Saving while the acknowledgement is held', async () => {
    const { handle } = mountPersistence(lesson())
    const held = handle.storage.hold()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    expect(handle.storage.saves).toHaveLength(1)
    expect(handle.persistence.state.kind).toBe('saving')

    await act(async () => {
      held.release()
      await Promise.resolve()
    })
    expect(handle.persistence.state.kind).toBe('saved')
  })

  it('holds the version storage returned, not one it guessed', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.persistence.token).toBe('v1')

    change(handle, 400)
    await tick(handle.scheduler, IDLE_MS)
    // The second save carries what the first was given — which is the whole mechanism behind
    // conflict detection, exercised here as an ordinary consequence.
    expect(handle.storage.saves[1]!.token).toBe('v1')
  })

  it('reports Saving from the moment a change arrives, not from the moment it sends', async () => {
    // `pending` and `saving` both read Saving to a teacher. The interval is not a period of
    // pretending nothing has happened.
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    expect(handle.persistence.state.kind).toBe('pending')
  })
})

describe('editing during a save', () => {
  it('is never blocked, and the newer state is saved afterwards (FR-023)', async () => {
    const { handle } = mountPersistence(lesson())
    const held = handle.storage.hold()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    // Mid-flight, the teacher keeps working.
    change(handle, 999)
    expect(handle.session.draft.slides[0]!.elements[0]!.width).toBe(999)

    await act(async () => {
      held.release()
      await Promise.resolve()
    })
    await tick(handle.scheduler, IDLE_MS)
    await settle()

    expect(handle.storage.saves).toHaveLength(2)
    expect(handle.storage.saves[1]!.manifest.slides[0]!.elements[0]!.width).toBe(999)
  })

  it('does not report Saved for a state that was already superseded', async () => {
    const { handle } = mountPersistence(lesson())
    const held = handle.storage.hold()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    change(handle, 999)

    await act(async () => {
      held.release()
      await Promise.resolve()
    })
    // The acknowledgement was for 321, and 999 is outstanding — so Saved would be false.
    expect(handle.persistence.state.kind).toBe('pending')
  })
})
