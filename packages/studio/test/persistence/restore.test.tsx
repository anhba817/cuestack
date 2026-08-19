import { act } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mountPersistence, settle, tick } from '../harness/persistence.js'
import { lessonWith, element } from '../harness/corpus.js'
import { IDLE_MS } from '../../src/persistence/schedule.js'

/**
 * Going back to yesterday, without erasing today.
 *
 * The ordering is the contract (storage-contract §5): a checkpoint of the state being left,
 * then the restore, then a checkpoint of the result. The first is what makes FR-042 true —
 * the state the teacher is leaving is itself in the history, so a restore they regret is one
 * they can walk back through the list as well as through undo.
 *
 * And the token `loadVersion` returns is the **current** draft's, not the loaded version's.
 * Return the old one and the very next save reads as a conflict: a restore that looks correct
 * right up until it is saved, which is the worst kind of wrong.
 */
afterEach(cleanup)

const lessonAt = (width: number) => lessonWith([element({ id: 'a', effects: [], width })])
const change = (handle: { session: { apply: (e: never) => unknown } }, width: number): void => {
  act(() => void (handle.session.apply as (e: unknown) => unknown)({
    kind: 'set-field',
    id: 'a',
    path: ['width'],
    value: width,
  }))
}

/** Three checkpoints, at widths 111, 222, and 333. */
async function withHistory() {
  const mounted = mountPersistence(lessonAt(100))
  const { handle } = mounted
  for (const width of [111, 222, 333]) {
    change(handle, width)
    await act(async () => {
      handle.persistence.checkpoint()
      await Promise.resolve()
    })
    await settle()
  }
  await act(async () => {
    await handle.persistence.loadVersions()
  })
  return mounted
}

describe('restoring an earlier checkpoint', () => {
  it('lists them newest first', async () => {
    const { handle } = await withHistory()
    const times = handle.persistence.versions.map((v) => v.versionNumber)
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('hands back that version’s content', async () => {
    const { handle } = await withHistory()
    const oldest = handle.persistence.versions[handle.persistence.versions.length - 1]!

    let result: { ok: boolean; manifest?: { slides: { elements: { width: number }[] }[] } } | null = null
    await act(async () => {
      result = (await handle.persistence.restoreVersion(oldest.token)) as never
    })
    expect(result!.ok).toBe(true)
    expect(result!.manifest!.slides[0]!.elements[0]!.width).toBe(111)
  })

  it('saves the state being left as a checkpoint first (FR-042)', async () => {
    const { handle } = await withHistory()
    change(handle, 999)
    const before = (await handle.storage.listVersions('lesson')).length
    const oldest = handle.persistence.versions[handle.persistence.versions.length - 1]!

    await act(async () => {
      await handle.persistence.restoreVersion(oldest.token)
    })
    const after = await handle.storage.listVersions('lesson')
    expect(after.length).toBe(before + 1)
  })

  it('removes no checkpoint made after the one restored (FR-DAT-010)', async () => {
    const { handle } = await withHistory()
    const tokens = (await handle.storage.listVersions('lesson')).map((v) => v.token)
    const oldest = handle.persistence.versions[handle.persistence.versions.length - 1]!

    await act(async () => {
      await handle.persistence.restoreVersion(oldest.token)
    })
    const after = (await handle.storage.listVersions('lesson')).map((v) => v.token)
    for (const token of tokens) expect(after).toContain(token)
  })

  it('leaves the next save a save, not a conflict', async () => {
    // The token assertion, exercised end to end: `loadVersion` returns the current draft's
    // token, so saving the restored content forward succeeds.
    const { handle } = await withHistory()
    const oldest = handle.persistence.versions[handle.persistence.versions.length - 1]!
    await act(async () => {
      await handle.persistence.restoreVersion(oldest.token)
    })

    change(handle, 444)
    await tick(handle.scheduler, IDLE_MS)
    expect(handle.persistence.conflict).toBeNull()
    expect(handle.persistence.state.kind).toBe('saved')
  })

  it('is reversible by one undo, like any other change (FR-041)', async () => {
    const { handle } = await withHistory()
    const before = JSON.stringify(handle.session.draft)
    const oldest = handle.persistence.versions[handle.persistence.versions.length - 1]!

    // Captured through a holder rather than a `let`: narrowing a `let` assigned inside a
    // callback is something TypeScript cannot follow, and a non-null assertion on it defeats
    // the discriminated union this result exists to be.
    const holder: { result?: Awaited<ReturnType<typeof handle.persistence.restoreVersion>> } = {}
    await act(async () => {
      holder.result = await handle.persistence.restoreVersion(oldest.token)
    })
    const restored = holder.result
    expect(restored?.ok).toBe(true)
    if (!restored?.ok) return
    act(() => void handle.session.apply({ kind: 'replace-draft', manifest: restored.manifest }))
    expect(JSON.stringify(handle.session.draft)).not.toBe(before)

    act(() => handle.session.undo())
    expect(JSON.stringify(handle.session.draft)).toBe(before)
  })
})

describe('when it cannot be done', () => {
  it('does not proceed if the pre-restore checkpoint fails (FR-042a)', async () => {
    // Continuing would discard unsaved work at the moment its safety net failed, which is the
    // opposite of what the checkpoint is for.
    const { handle } = await withHistory()
    const oldest = handle.persistence.versions[handle.persistence.versions.length - 1]!
    change(handle, 999)
    handle.storage.fail('unavailable')

    let result: { ok: boolean; message?: string } | null = null
    await act(async () => {
      result = (await handle.persistence.restoreVersion(oldest.token)) as never
    })
    expect(result!.ok).toBe(false)
    expect(result!.message).toMatch(/could not be saved first/i)
    // And the draft is untouched.
    expect(handle.session.draft.slides[0]!.elements[0]!.width).toBe(999)
  })

  it('reports a version that cannot be opened, changing nothing', async () => {
    const { handle } = await withHistory()
    let result: { ok: boolean; message?: string } | null = null
    await act(async () => {
      result = (await handle.persistence.restoreVersion('v-nonexistent')) as never
    })
    expect(result!.ok).toBe(false)
    expect(result!.message).toMatch(/nothing has been changed/i)
  })
})

describe('an unreachable history', () => {
  it('says so rather than presenting as empty (FR-043)', async () => {
    const { handle } = mountPersistence(lessonAt(100))
    handle.storage.fail('unavailable')
    await act(async () => {
      await handle.persistence.loadVersions()
    })
    expect(handle.persistence.versionsUnavailable).toBe(true)
  })

  it('and an empty history is not reported as unreachable', async () => {
    const { handle } = mountPersistence(lessonAt(100))
    handle.storage.seed('lesson', lessonAt(100))
    await act(async () => {
      await handle.persistence.loadVersions()
    })
    expect(handle.persistence.versionsUnavailable).toBe(false)
    expect(handle.persistence.versions).toHaveLength(0)
  })
})
