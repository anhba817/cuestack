import { act } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mountPersistence, settle, tick } from '../harness/persistence.js'
import { renderEditor } from '../harness/editor.js'
import { lessonWith, element } from '../harness/corpus.js'
import { IDLE_MS } from '../../src/persistence/schedule.js'

/**
 * None of this feature is authored data.
 *
 * FR-045 and Constitution V: history, save state, kept work, checkpoints, and the author
 * identity are all session state. Not one of them enters the manifest, and nothing about them
 * can reach a learner.
 *
 * The assertion is an **executable comparison** rather than a promise. Two editors receive the
 * same edits; one has the whole persistence machinery attached and the other has none at all.
 * If a single field leaked, the manifests would differ.
 */
afterEach(cleanup)

const lesson = () => lessonWith([element({ id: 'a', effects: [], width: 100 })])

/** The same sequence of edits, applied to whichever session is handed in. */
function exercise(session: {
  apply: (e: never) => unknown
  undo: () => void
  select: (ids: string[]) => void
  endEditRun: () => void
}): void {
  const apply = session.apply as unknown as (e: unknown) => unknown
  act(() => void apply({ kind: 'set-field', id: 'a', path: ['width'], value: 321 }))
  act(() => session.endEditRun())
  act(() => void apply({ kind: 'add-element', type: 'text' }))
  act(() => void apply({ kind: 'set-slide-field', path: ['durationMs'], value: 9000 }))
  act(() => session.undo())
  act(() => void apply({ kind: 'set-field', id: 'a', path: ['height'], value: 55 }))
}

describe('persistence changes nothing about the lesson', () => {
  it('produces the same manifest as an editor with no persistence at all', async () => {
    const withSaving = mountPersistence(lesson(), { identity: 'teacher' })
    exercise(withSaving.handle.session)
    await tick(withSaving.handle.scheduler, IDLE_MS)
    await settle()
    cleanup()

    const withoutSaving = renderEditor(lesson())
    exercise(withoutSaving.handle.session)

    // Lesson ids differ per fixture, so the comparison is of everything else.
    const normalise = (m: unknown): string =>
      JSON.stringify(m).replace(/lesson-\d+/g, 'L').replace(/slide-\d+/g, 'S')

    expect(normalise(withSaving.handle.session.draft)).toBe(
      normalise(withoutSaving.handle.session.draft),
    )
  })

  it('sends a manifest carrying no save state, identity, or history', async () => {
    const { handle } = mountPersistence(lesson(), { identity: 'teacher-a' })
    act(() => void handle.session.apply({ kind: 'set-field', id: 'a', path: ['width'], value: 321 }))
    await tick(handle.scheduler, IDLE_MS)

    const sent = JSON.stringify(handle.storage.saves[0]!.manifest)
    for (const leak of ['teacher-a', 'runKey', 'selectionBefore', 'saving', 'checkpoint', 'keepFailed']) {
      expect(sent).not.toContain(leak)
    }
  })

  it('a full cycle leaves the lesson byte-identical to where its edits left it', async () => {
    // Edit, save, conflict, keep, undo — then compare against the same edits with nothing
    // attached. Every one of those touches state that must never be authored data.
    const { handle } = mountPersistence(lesson(), { openedAt: 'v1', identity: 'teacher' })
    handle.storage.seed('lesson', lesson())
    await handle.storage.clobber(lessonWith([element({ id: 'a', effects: [], width: 777 })]))

    act(() => void handle.session.apply({ kind: 'set-field', id: 'a', path: ['width'], value: 321 }))
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.persistence.conflict).not.toBeNull()

    act(() => handle.persistence.keepMine())
    await tick(handle.scheduler, IDLE_MS)
    await settle()
    act(() => handle.session.undo())

    expect(handle.session.draft.slides[0]!.elements[0]!.width).toBe(100)
  })
})
