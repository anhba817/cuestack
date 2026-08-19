import { act } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mountPersistence, tick } from '../harness/persistence.js'
import { lessonWith, element } from '../harness/corpus.js'
import { IDLE_MS } from '../../src/persistence/schedule.js'

/**
 * The lesson saves itself, roughly a second and a half after the teacher stops.
 *
 * Not one test here waits on real time. Every interval runs on the injected `Scheduler`, so
 * an assertion about 1.5 seconds costs nothing to run and never flakes under load —
 * Constitution II's requirement, and the reason the port exists at all.
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

describe('autosave begins after the teacher stops', () => {
  it('does not save before the interval elapses', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS - 1)
    expect(handle.storage.saves).toHaveLength(0)
  })

  it('saves once it does', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.storage.saves).toHaveLength(1)
  })

  it('sends the change, not the state the lesson opened at', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    const sent = handle.storage.saves[0]!.manifest
    expect(sent.slides[0]!.elements[0]!.width).toBe(321)
  })

  it('carries the version the editor last knew about (FR-030)', async () => {
    const { handle } = mountPersistence(lesson(), { openedAt: 'v7' })
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.storage.saves[0]!.token).toBe('v7')
  })
})

describe('a change while one is pending restarts the interval', () => {
  it('a teacher typing steadily produces one save, not one per keystroke (FR-015)', async () => {
    const { handle } = mountPersistence(lesson())
    for (const width of [100, 200, 300, 400, 500]) {
      change(handle, width)
      await tick(handle.scheduler, IDLE_MS - 200)
    }
    expect(handle.storage.saves).toHaveLength(0)

    await tick(handle.scheduler, IDLE_MS)
    expect(handle.storage.saves).toHaveLength(1)
    expect(handle.storage.saves[0]!.manifest.slides[0]!.elements[0]!.width).toBe(500)
  })
})

describe('opening a lesson is not an edit', () => {
  it('saves nothing at all when nothing happens (FR-018)', async () => {
    // The mount effect fires once with the initial draft, so without skipping the first the
    // editor would save on open — and under FR-035a mint a checkpoint nobody asked for.
    const { handle } = mountPersistence(lesson())
    await tick(handle.scheduler, IDLE_MS * 10)
    expect(handle.storage.saves).toHaveLength(0)
  })

  it('and reads Saved while there is nothing outstanding', async () => {
    const { handle } = mountPersistence(lesson())
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.persistence.state.kind).toBe('idle')
  })
})

describe('saving now', () => {
  it('starts immediately rather than waiting out the interval (FR-020)', async () => {
    const { handle } = mountPersistence(lesson())
    change(handle, 321)
    await act(async () => {
      handle.persistence.saveNow()
      await Promise.resolve()
    })
    expect(handle.storage.saves).toHaveLength(1)
  })

  it('does nothing when there is nothing outstanding', async () => {
    const { handle } = mountPersistence(lesson())
    await act(async () => {
      handle.persistence.saveNow()
      await Promise.resolve()
    })
    expect(handle.storage.saves).toHaveLength(0)
  })
})
