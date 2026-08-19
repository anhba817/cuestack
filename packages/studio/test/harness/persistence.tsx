import * as React from 'react'
import { act, render } from '@testing-library/react'
import type { LessonManifest } from '@cuestack/schema'
import { useEditorSession, type EditorSession } from '../../src/session/useEditorSession.js'
import { useDraftPersistence, type DraftPersistence } from '../../src/persistence/useDraftPersistence.js'
import { countingIds } from './ids.js'
import { testScheduler, type TestScheduler } from './scheduler.js'
import { recordingStorage, type RecordingStorage } from './storage.js'
import { spyKeeper, type SpyKeeper } from './keeper.js'
import type { Connectivity, VisibilityPort } from '@cuestack/core'

/** A network the test decides the state of. */
export function testConnectivity(online = true) {
  let current = online
  const listeners = new Set<(online: boolean) => void>()
  return {
    isOnline: () => current,
    subscribe(listener: (online: boolean) => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    set(next: boolean) {
      current = next
      for (const listener of listeners) listener(next)
    },
  }
}

/** A document whose hidden state a test flips, rather than dispatching a DOM event. */
export function testVisibility() {
  let hidden = false
  const listeners = new Set<(hidden: boolean) => void>()
  return {
    isHidden: () => hidden,
    subscribe(listener: (hidden: boolean) => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    hide() {
      hidden = true
      for (const listener of listeners) listener(true)
    },
  }
}

/**
 * The editor's session and its save loop, mounted together the way a host mounts them.
 *
 * Inside the tree for the reason `editor.tsx` gives at length: a hook whose result is passed
 * as a prop hands one snapshot down, and every later state change updates the holder while the
 * rendered component keeps the old object.
 *
 * Nothing here waits. Time moves when a test says `scheduler.advance(...)`, which is what
 * Constitution II asks for and what makes an assertion about a 1.5-second interval take no
 * time at all to run.
 */
export interface PersistenceHandle {
  readonly session: EditorSession
  readonly persistence: DraftPersistence
  readonly storage: RecordingStorage
  readonly scheduler: TestScheduler
  readonly keeper: SpyKeeper
}

export interface MountOptions {
  readonly storage?: RecordingStorage
  readonly scheduler?: TestScheduler
  readonly openedAt?: string
  readonly keeper?: SpyKeeper
  readonly identity?: string
  readonly connectivity?: Connectivity
  readonly visibility?: VisibilityPort
}

export function mountPersistence(manifest: LessonManifest, options: MountOptions = {}) {
  const storage = options.storage ?? recordingStorage()
  const scheduler = options.scheduler ?? testScheduler()
  const keeper = options.keeper ?? spyKeeper()
  const holder = {
    session: undefined as unknown as EditorSession,
    persistence: undefined as unknown as DraftPersistence,
    storage,
    scheduler,
    keeper,
  }
  const idSource = countingIds()

  function Harness(): React.ReactNode {
    const session = useEditorSession({ manifest, slideId: manifest.slides[0]!.id, idSource })
    const persistence = useDraftPersistence({
      storage,
      lessonId: 'lesson',
      openedAt: options.openedAt ?? 'v0',
      draft: session.draft,
      scheduler,
      keeper,
      ...(options.identity !== undefined ? { identity: options.identity } : {}),
      ...(options.connectivity ? { connectivity: options.connectivity } : {}),
      ...(options.visibility ? { ports: { visibility: options.visibility } } : {}),
    })
    holder.session = session
    holder.persistence = persistence
    return null
  }

  const { unmount } = render(<Harness />)
  return { handle: holder as PersistenceHandle, unmount }
}

/**
 * Move the injected clock, then let the promises the timer started settle.
 *
 * The second half matters as much as the first: `saveDraft` is async, so advancing time
 * schedules the attempt and only a flushed microtask queue makes its result observable.
 */
export async function tick(scheduler: TestScheduler, ms: number): Promise<void> {
  await act(async () => {
    scheduler.advance(ms)
    await Promise.resolve()
    await Promise.resolve()
  })
}

/** Let an already-started save settle without moving time at all. */
export async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}
