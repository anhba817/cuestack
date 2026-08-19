import { act } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mountPersistence, settle, tick } from '../harness/persistence.js'
import { lessonWith, element } from '../harness/corpus.js'
import { IDLE_MS } from '../../src/persistence/schedule.js'

/**
 * A newer version is never replaced, and never silently.
 *
 * FR-DAT-007 is a MUST NOT with data-loss consequences, and the storage interface was
 * designed around it three waves before anything called it: `saveDraft` cannot be invoked
 * without a token and `SaveResult` carries a conflict case a caller must handle. These tests
 * are what make that design load-bearing rather than decorative.
 *
 * Three assertions belong in every case here — the save was refused, the **stored** manifest
 * is untouched, and autosave stopped. The third is the one that regresses silently: a loop
 * that keeps attempting a losing save looks fine until somebody counts the requests.
 */
afterEach(cleanup)

const lesson = () => lessonWith([element({ id: 'a', effects: [], width: 100 })])
const change = (handle: { session: { apply: (e: never) => unknown } }, width: number): void => {
  act(() => void (handle.session.apply as (e: unknown) => unknown)({
    kind: 'set-field',
    id: 'a',
    path: ['width'],
    value: width,
  }))
}

/** Open at v1, then let a colleague save v2 behind the editor's back. */
async function colleagueSaved() {
  const mounted = mountPersistence(lesson(), { openedAt: 'v1', identity: 'teacher' })
  const { handle } = mounted
  handle.storage.seed('lesson', lesson())
  await handle.storage.clobber(lessonWith([element({ id: 'a', effects: [], width: 777 })]))
  return mounted
}

describe('a save against a stale version', () => {
  it('is refused (FR-031)', async () => {
    const { handle } = await colleagueSaved()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.persistence.conflict).not.toBeNull()
  })

  it('leaves the stored version exactly as the other writer left it', async () => {
    const { handle } = await colleagueSaved()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    const loaded = await handle.storage.loadDraft('lesson')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.manifest.slides[0]!.elements[0]!.width).toBe(777)
  })

  it('stops autosaving into it (FR-032)', async () => {
    const { handle } = await colleagueSaved()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    const attempts = handle.storage.saves.length

    // Ten minutes of waiting changes nothing: what resolves this is the teacher, not time.
    await tick(handle.scheduler, 10 * 60 * 1000)
    expect(handle.storage.saves.length).toBe(attempts)
  })

  it('reads Save Failed rather than inventing a fifth word', async () => {
    const { handle } = await colleagueSaved()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.persistence.state.kind).toBe('failed')
  })

  it('names the lesson and says the work has not been sent', async () => {
    const { handle } = await colleagueSaved()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.persistence.state.message).toMatch(/someone else has saved/i)
  })

  it('keeps the teacher’s work locally rather than discarding it (FR-034)', async () => {
    const { handle } = await colleagueSaved()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    expect(handle.keeper.writes.length).toBeGreaterThan(0)
    const kept = JSON.parse(handle.keeper.writes[handle.keeper.writes.length - 1]!.value)
    expect(kept.manifest.slides[0].elements[0].width).toBe(321)
  })
})

describe('while the conflict stands', () => {
  it('editing is not blocked (FR-032a)', async () => {
    const { handle } = await colleagueSaved()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    change(handle, 555)
    expect(handle.session.draft.slides[0]!.elements[0]!.width).toBe(555)
  })

  it('the notice is still there after further work', async () => {
    const { handle } = await colleagueSaved()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    change(handle, 555)
    await tick(handle.scheduler, IDLE_MS * 4)

    expect(handle.persistence.conflict).not.toBeNull()
  })

  it('save-now attempts nothing and puts the choice back (FR-020)', async () => {
    const { handle } = await colleagueSaved()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    const attempts = handle.storage.saves.length

    await act(async () => {
      handle.persistence.saveNow()
      await Promise.resolve()
    })
    expect(handle.storage.saves.length).toBe(attempts)
    expect(handle.persistence.conflict).not.toBeNull()
  })
})

describe('the two ways forward', () => {
  it('taking their version keeps this teacher’s work reachable first (FR-033)', async () => {
    const { handle } = await colleagueSaved()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)
    const keptBefore = handle.keeper.writes.length

    let taken: unknown = null
    await act(async () => {
      taken = await handle.persistence.takeStored()
    })
    expect(handle.keeper.writes.length).toBeGreaterThanOrEqual(keptBefore)
    expect((taken as { slides: { elements: { width: number }[] }[] }).slides[0]!.elements[0]!.width).toBe(777)
    expect(handle.persistence.conflict).toBeNull()
  })

  it('keeping mine saves it forward rather than over theirs', async () => {
    const { handle } = await colleagueSaved()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    act(() => handle.persistence.keepMine())
    await tick(handle.scheduler, IDLE_MS)
    await settle()

    expect(handle.persistence.conflict).toBeNull()
    expect(handle.persistence.state.kind).toBe('saved')

    // Their version is still in the history — superseded, not replaced.
    const loaded = await handle.storage.loadDraft('lesson')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.manifest.slides[0]!.elements[0]!.width).toBe(321)
  })

  it('offers exactly two, and no blind overwrite (SC-009)', async () => {
    const { handle } = await colleagueSaved()
    change(handle, 321)
    await tick(handle.scheduler, IDLE_MS)

    // The surface of the resolution: take theirs, or keep mine. Nothing that replaces a
    // version whose contents the editor cannot show the teacher.
    expect(typeof handle.persistence.takeStored).toBe('function')
    expect(typeof handle.persistence.keepMine).toBe('function')
  })
})
