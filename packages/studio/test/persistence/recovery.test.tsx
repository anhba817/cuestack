import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useDraftRecovery, type DraftRecovery } from '../../src/persistence/useDraftRecovery.js'
import { recordingStorage } from '../harness/storage.js'
import { spyKeeper } from '../harness/keeper.js'
import { keyFor } from '../../src/persistence/keeper.js'
import { lessonWith, element } from '../harness/corpus.js'

/**
 * Reopening after an interruption, and the choice that comes before the lesson does.
 *
 * The editor is not mounted here at all, which is the point: FR-027a says the recovery choice
 * is answered *before* the lesson opens, because the editor cannot render a lesson until it
 * knows which copy it is rendering. So this runs against the hook that decides that, and the
 * unmount between the interruption and the reopen is the closest a suite gets to a browser
 * refresh — the keeper is the only thing carrying state across.
 */
afterEach(cleanup)

const stored = () => lessonWith([element({ id: 'a', effects: [], width: 100 })])
const keptManifest = () => lessonWith([element({ id: 'a', effects: [], width: 999 })])

function open(options: {
  keeper: ReturnType<typeof spyKeeper>
  storage: ReturnType<typeof recordingStorage>
  identity?: string
}) {
  const holder = { recovery: undefined as unknown as DraftRecovery }
  function Harness(): React.ReactNode {
    holder.recovery = useDraftRecovery({
      storage: options.storage,
      lessonId: 'lesson',
      keeper: options.keeper,
      ...(options.identity !== undefined ? { identity: options.identity } : {}),
    })
    return null
  }
  const result = render(<Harness />)
  return { holder, ...result }
}

const settle = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('with nothing kept', () => {
  it('opens the stored lesson without asking', async () => {
    const storage = recordingStorage()
    storage.seed('lesson', stored())
    const { holder } = open({ keeper: spyKeeper(), storage })
    await settle()

    expect(holder.recovery.status).toBe('ready')
    expect(holder.recovery.manifest?.slides[0]!.elements[0]!.width).toBe(100)
  })
})

describe('with work an interruption left behind', () => {
  function withKept(identity = 'teacher') {
    const storage = recordingStorage()
    storage.seed('lesson', stored())
    const keeper = spyKeeper()
    keeper.write(
      keyFor(identity, 'lesson'),
      JSON.stringify({ lessonId: 'lesson', manifest: keptManifest(), token: 'v1' }),
    )
    return { storage, keeper, identity }
  }

  it('does not open the lesson until the teacher chooses (FR-027a)', async () => {
    const { holder } = open(withKept())
    await settle()
    expect(holder.recovery.status).toBe('offer')
  })

  it('opens with the kept work when they restore it', async () => {
    const { holder } = open(withKept())
    await settle()
    act(() => holder.recovery.restoreKept())

    expect(holder.recovery.status).toBe('ready')
    expect(holder.recovery.manifest?.slides[0]!.elements[0]!.width).toBe(999)
  })

  it('opens the stored lesson when they discard it, and removes the local copy', async () => {
    const setup = withKept()
    const { holder } = open(setup)
    await settle()
    act(() => holder.recovery.discardKept())

    expect(holder.recovery.status).toBe('ready')
    expect(holder.recovery.manifest?.slides[0]!.elements[0]!.width).toBe(100)
    expect(setup.keeper.clears).toContain(keyFor('teacher', 'lesson'))
  })

  it('never applies it silently, and never discards it silently', async () => {
    const setup = withKept()
    const { holder } = open(setup)
    await settle()
    // Before an answer: nothing opened, and nothing was thrown away.
    expect(holder.recovery.status).toBe('offer')
    expect(setup.keeper.clears).toHaveLength(0)
  })
})

describe('when the stored lesson moved on since', () => {
  it('says so, because the teacher is choosing between two versions (FR-027b)', async () => {
    const storage = recordingStorage()
    storage.seed('lesson', stored())
    const keeper = spyKeeper()
    // Kept against v1; storage has since moved to v2 — somebody else saved.
    keeper.write(
      keyFor('teacher', 'lesson'),
      JSON.stringify({ lessonId: 'lesson', manifest: keptManifest(), token: 'v-old' }),
    )
    const { holder } = open({ keeper, storage, identity: 'teacher' })
    await settle()

    expect(holder.recovery.status).toBe('offer')
    expect(holder.recovery.movedOn).toBe(true)
  })

  it('and does not say so when nobody did', async () => {
    const storage = recordingStorage()
    storage.seed('lesson', stored())
    const loaded = await storage.loadDraft('lesson')
    const keeper = spyKeeper()
    keeper.write(
      keyFor('teacher', 'lesson'),
      JSON.stringify({
        lessonId: 'lesson',
        manifest: keptManifest(),
        token: loaded.ok ? loaded.token : 'v1',
      }),
    )
    const { holder } = open({ keeper, storage, identity: 'teacher' })
    await settle()

    expect(holder.recovery.movedOn).toBe(false)
  })
})

describe('corrupt kept work', () => {
  it('is discarded rather than crashing the editor', async () => {
    // The teacher's stored lesson is intact, which is the better of the two things to protect.
    const storage = recordingStorage()
    storage.seed('lesson', stored())
    const keeper = spyKeeper()
    keeper.write(keyFor('teacher', 'lesson'), 'not json at all')
    const { holder } = open({ keeper, storage, identity: 'teacher' })
    await settle()

    expect(holder.recovery.status).toBe('ready')
    expect(holder.recovery.manifest?.slides[0]!.elements[0]!.width).toBe(100)
  })
})
