import { act } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mountPersistence, testConnectivity, testVisibility, tick } from '../harness/persistence.js'
import { lessonWith, element } from '../harness/corpus.js'
import { BACKOFF_MS, IDLE_MS } from '../../src/persistence/schedule.js'

/**
 * A dropped connection costs nothing, and costs nothing to survive.
 *
 * The write-schedule assertion is the one to read twice. Keeping runs on the save schedule,
 * not on every change — `localStorage` is synchronous and this writes a whole manifest, and
 * the inspector commits on every `onChange`, so per-change keeping would put a 300-element
 * lesson's serialization between a key press and the character appearing. Move it back onto
 * the change path and the count below fails while every other test here still passes, which
 * is exactly why T091 lists it as a negative control.
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

describe('while storage is unreachable', () => {
  it('reports Offline and keeps the newest state (FR-024)', async () => {
    const { handle } = mountPersistence(lesson(), { identity: 'teacher' })
    handle.storage.fail('unavailable')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    expect(handle.persistence.state.kind).toBe('offline')
    expect(handle.keeper.writes).toHaveLength(1)
    const kept = JSON.parse(handle.keeper.writes[0]!.value)
    expect(kept.manifest.slides[0].elements[0].width).toBe(321)
  })

  it('keeps once per save attempt, not once per change (FR-024a)', async () => {
    const { handle } = mountPersistence(lesson(), { identity: 'teacher' })
    handle.storage.fail('unavailable')

    // Twenty changes inside one interval.
    for (let i = 1; i <= 20; i++) {
      change(handle, 100 + i)
      await tick(handle.scheduler, 10)
    }
    expect(handle.keeper.writes).toHaveLength(0)

    await tick(handle.scheduler, IDLE_MS)
    expect(handle.keeper.writes).toHaveLength(1)
  })

  it('keeps the newest state, not the one that was pending when it dropped', async () => {
    const { handle } = mountPersistence(lesson(), { identity: 'teacher' })
    handle.storage.fail('unavailable')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    change(handle, 999)
    await tick(handle.scheduler, IDLE_MS)

    const last = JSON.parse(handle.keeper.writes[handle.keeper.writes.length - 1]!.value)
    expect(last.manifest.slides[0].elements[0].width).toBe(999)
  })
})

describe('when the connection returns', () => {
  it('resends without the teacher asking (FR-025)', async () => {
    const { handle } = mountPersistence(lesson(), { identity: 'teacher' })
    handle.storage.fail('unavailable')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.persistence.state.kind).toBe('offline')

    handle.storage.fail(null)
    await tick(handle.scheduler, BACKOFF_MS[0]!)
    expect(handle.persistence.state.kind).toBe('saved')
  })

  it('does not wait out the backoff when the browser says so first', async () => {
    const connectivity = testConnectivity()
    const { handle } = mountPersistence(lesson(), { identity: 'teacher', connectivity })
    handle.storage.fail('unavailable')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    const attempts = handle.storage.saves.length

    handle.storage.fail(null)
    await act(async () => {
      connectivity.set(true)
      await Promise.resolve()
      await Promise.resolve()
    })
    // Immediately, rather than a second into the first backoff.
    expect(handle.storage.saves.length).toBe(attempts + 1)
    expect(handle.persistence.state.kind).toBe('saved')
  })

  it('clears the kept copy once storage acknowledges it (FR-028)', async () => {
    const { handle } = mountPersistence(lesson(), { identity: 'teacher' })
    handle.storage.fail('unavailable')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.keeper.writes).toHaveLength(1)

    handle.storage.fail(null)
    await tick(handle.scheduler, BACKOFF_MS[0]!)
    expect(handle.keeper.clears.length).toBeGreaterThan(0)
  })
})

describe('before the page goes away', () => {
  it('writes what is outstanding when the document is hidden (FR-024b)', async () => {
    const visibility = testVisibility()
    const { handle } = mountPersistence(lesson(), { identity: 'teacher', visibility })
    change(handle, 321)
    // Inside the interval: nothing kept yet, and a refresh here would lose it.
    expect(handle.keeper.writes).toHaveLength(0)

    act(() => visibility.hide())
    expect(handle.keeper.writes).toHaveLength(1)
  })

  it('writes nothing when there is nothing outstanding', async () => {
    // The guard is load-bearing: `visibilitychange` fires on every tab switch, and flushing
    // unconditionally would reintroduce the cost FR-024a exists to avoid.
    const visibility = testVisibility()
    const { handle } = mountPersistence(lesson(), { identity: 'teacher', visibility })
    act(() => visibility.hide())
    expect(handle.keeper.writes).toHaveLength(0)
  })
})

describe('when the browser refuses to keep it', () => {
  it('says so rather than failing silently (FR-024c)', async () => {
    const { handle } = mountPersistence(lesson(), { identity: 'teacher' })
    handle.storage.fail('unavailable')
    handle.keeper.refuse('full')
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    expect(handle.persistence.keepFailed).toBe(true)
  })
})
