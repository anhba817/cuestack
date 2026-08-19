import { act } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mountPersistence, settle, tick } from '../harness/persistence.js'
import { lessonWith, element } from '../harness/corpus.js'
import { CHECKPOINT_INTERVAL_MS, IDLE_MS } from '../../src/persistence/schedule.js'

/**
 * An hour of editing is dozens of saves and a handful of checkpoints.
 *
 * This is the test that proves the clarification. Every save must advance the version or a
 * conflict cannot be detected; almost none may appear in a list a teacher reads, or the
 * history is hundreds of indistinguishable rows and useless at the moment it is needed
 * (SC-010a).
 *
 * Make the adapter record an entry per save and this fails while every other test passes,
 * which is why T091 lists it as a negative control.
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

describe('an hour of continued editing', () => {
  it('saves dozens of times and records a handful of checkpoints (SC-010a)', async () => {
    const { handle } = mountPersistence(lesson())

    // Roughly an hour: a change, then the interval, over and over.
    for (let i = 0; i < 60; i++) {
      change(handle, 100 + i)
      await tick(handle.scheduler, IDLE_MS)
      await tick(handle.scheduler, 58_500)
    }
    await settle()

    expect(handle.storage.saves.length).toBeGreaterThanOrEqual(50)
    const entries = await handle.storage.listVersions('lesson')
    expect(entries.length).toBeLessThanOrEqual(5)
    expect(entries.length).toBeGreaterThan(0)
  })

  it('records the first acknowledged save after the lesson opens', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    expect(handle.storage.saves[0]!.options?.checkpoint).toBeDefined()
  })

  it('and not the second, third, or fourth', async () => {
    const { handle } = mountPersistence(lesson())
    for (let i = 0; i < 4; i++) {
      change(handle, 200 + i)
      await tick(handle.scheduler, IDLE_MS)
    }
    const asked = handle.storage.saves.filter((s) => s.options?.checkpoint).length
    expect(asked).toBe(1)
  })

  it('records another once a quarter hour of editing has accumulated', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 100)
    await tick(handle.scheduler, IDLE_MS)

    // Editing time accrues in interval-sized pieces, so many changes are needed to reach it.
    const steps = Math.ceil(CHECKPOINT_INTERVAL_MS / IDLE_MS) + 2
    for (let i = 0; i < steps; i++) {
      change(handle, 200 + i)
      await tick(handle.scheduler, IDLE_MS)
    }
    const asked = handle.storage.saves.filter((s) => s.options?.checkpoint).length
    expect(asked).toBeGreaterThanOrEqual(2)
  })
})

describe('an editor left open', () => {
  it('records nothing while nobody is editing', async () => {
    // The interval counts *continued editing*, not wall-clock time — a lesson left open
    // overnight must not accumulate checkpoints (FR-035a).
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    const after = handle.storage.saves.length

    await tick(handle.scheduler, 8 * 60 * 60 * 1000)
    expect(handle.storage.saves.length).toBe(after)
  })
})

describe('asking for one', () => {
  it('records a checkpoint on request, by name (FR-035b)', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    change(handle, 400)
    await act(async () => {
      handle.persistence.checkpoint('Before I rearranged everything')
      await Promise.resolve()
    })
    await settle()

    const named = handle.storage.saves.find(
      (s) => s.options?.checkpoint && 'label' in s.options.checkpoint,
    )
    expect(named?.options?.checkpoint?.label).toBe('Before I rearranged everything')
  })

  it('appears in the history under that name', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await act(async () => {
      handle.persistence.checkpoint('A good place to come back to')
      await Promise.resolve()
    })
    await settle()

    const entries = await handle.storage.listVersions('lesson')
    expect(entries.some((e) => e.label === 'A good place to come back to')).toBe(true)
  })
})

describe('saves between checkpoints', () => {
  it('are still what loadDraft returns (FR-035c)', async () => {
    // The case an adapter can fail while passing every history test — and it costs an hour of
    // work when it does.
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    change(handle, 999)
    await tick(handle.scheduler, IDLE_MS)

    const loaded = await handle.storage.loadDraft('lesson')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.manifest.slides[0]!.elements[0]!.width).toBe(999)
    expect(await handle.storage.listVersions('lesson')).toHaveLength(1)
  })
})
