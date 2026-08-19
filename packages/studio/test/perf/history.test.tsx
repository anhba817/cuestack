import { act } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderEditor } from '../harness/editor.js'
import { mountPersistence, tick } from '../harness/persistence.js'
import { largeLesson } from '../harness/large.js'
import { IDLE_MS } from '../../src/persistence/schedule.js'

/**
 * The budgets, on the lesson NFR-PERF-001 names.
 *
 * Three measurements, and the third is the one that would otherwise go unwatched. Recording a
 * step is a push of an existing reference — `applyEdit` already cloned, and nothing writes to
 * a returned draft — so it should cost nothing measurable. Keeping is a whole-manifest write
 * to synchronous storage, so it must stay **off** the change path; if it ever moves back, the
 * offline measurement is where it shows up rather than in a jank report from a teacher on a
 * train (SC-003, SC-010d, FR-047).
 */
afterEach(cleanup)

const BUDGET_MS = 100
const firstElementId = (draft: { slides: { elements: { id: string }[] }[] }) =>
  draft.slides[0]!.elements[0]!.id

describe('on the 50-slide, 300-element lesson', () => {
  it('applies a change within the input-to-feedback budget', () => {
    const { handle } = renderEditor(largeLesson())
    const id = firstElementId(handle.session.draft)

    const started = performance.now()
    act(() => void handle.session.apply({ kind: 'set-field', id, path: ['width'], value: 321 }))
    const elapsed = performance.now() - started

    expect(elapsed).toBeLessThan(BUDGET_MS)
  })

  it('reverses within 100 ms with a full history behind it (SC-003)', () => {
    const { handle } = renderEditor(largeLesson())
    const id = firstElementId(handle.session.draft)

    // Fill the history to its depth, each step its own so nothing collapses.
    for (let i = 0; i < 50; i++) {
      act(() => void handle.session.apply({ kind: 'set-field', id, path: ['width'], value: 200 + i }))
      act(() => handle.session.endEditRun())
    }

    const started = performance.now()
    act(() => handle.session.undo())
    const elapsed = performance.now() - started

    expect(elapsed).toBeLessThan(BUDGET_MS)
  })

  it('applies a change while offline within the same budget (SC-010d)', async () => {
    const { handle } = mountPersistence(largeLesson(), { identity: 'teacher' })
    handle.storage.fail('unavailable')
    const id = firstElementId(handle.session.draft)

    // Drive it into the offline state first, so the keeper is live.
    act(() => void handle.session.apply({ kind: 'set-field', id, path: ['width'], value: 111 }))
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.persistence.state.kind).toBe('offline')

    const started = performance.now()
    act(() => void handle.session.apply({ kind: 'set-field', id, path: ['width'], value: 222 }))
    const elapsed = performance.now() - started

    expect(elapsed).toBeLessThan(BUDGET_MS)
  })

  it('keeps once per save attempt however many changes arrive', async () => {
    // The structural half of the measurement above: the write count, which does not depend on
    // how fast the machine running the suite happens to be.
    const { handle } = mountPersistence(largeLesson(), { identity: 'teacher' })
    handle.storage.fail('unavailable')
    const id = firstElementId(handle.session.draft)

    for (let i = 0; i < 30; i++) {
      act(() => void handle.session.apply({ kind: 'set-field', id, path: ['width'], value: 300 + i }))
    }
    expect(handle.keeper.writes).toHaveLength(0)

    await tick(handle.scheduler, IDLE_MS)
    expect(handle.keeper.writes).toHaveLength(1)
  })
})
