import * as React from 'react'
import { act, render } from '@testing-library/react'
import type { LessonManifest } from '@cuestack/schema'
import {
  createMemoryPublishing,
  type AssetAdapter,
  type AssetLocation,
  type ElementRegistry,
  type PublishRefusal,
  type PublishingAdapter,
  type ValidationPolicy,
} from '@cuestack/core'
import { useEditorSession, type EditorSession } from '../../src/session/useEditorSession.js'
import { useDraftPersistence, type DraftPersistence } from '../../src/persistence/useDraftPersistence.js'
import { usePublishing, type Publishing } from '../../src/publishing/usePublishing.js'
import { useValidation, type Validation } from '../../src/validation/useValidation.js'
import { ValidationReport } from '../../src/validation/ValidationReport.js'
import { PublishControls } from '../../src/publishing/PublishControls.js'
import { countingIds } from './ids.js'
import { testScheduler, type TestScheduler } from './scheduler.js'
import { recordingStorage, type RecordingStorage } from './storage.js'

/**
 * A recording adapter over the **real** in-memory reference.
 *
 * Core has one of these too (`packages/core/test/harness/publishing.ts`), and this is not that file
 * reached across a package boundary: `@cuestack/core` publishes one entry point and its test
 * harnesses are not part of it, deliberately. What matters is shared anyway — the *implementation*
 * under the recorder is `createMemoryPublishing`, which core exports, so a studio test still cannot
 * pass because the double was more forgiving than the contract. Only the recording wrapper is
 * duplicated, and it holds no behaviour to drift.
 */
export interface RecordingPublishing extends PublishingAdapter {
  readonly calls: readonly { method: string; args: readonly unknown[] }[]
  refuseWith(reason: PublishRefusal | null): void
}

export function recordingPublishing(inner?: PublishingAdapter): RecordingPublishing {
  const real = inner ?? createMemoryPublishing()
  const calls: { method: string; args: readonly unknown[] }[] = []
  let refusal: PublishRefusal | null = null

  const wrap =
    <A extends unknown[], R>(method: string, fn: (...args: A) => Promise<R>, refusable = true) =>
    async (...args: A): Promise<R> => {
      calls.push({ method, args })
      if (refusable && refusal) return { ok: false, reason: refusal } as R
      return fn(...args)
    }

  return {
    calls,
    refuseWith: (reason) => {
      refusal = reason
    },
    publish: wrap('publish', (lessonId: string, manifest, by: string) =>
      real.publish(lessonId, manifest, by),
    ),
    listPublished: wrap('listPublished', (lessonId: string) => real.listPublished(lessonId), false),
    loadPublished: wrap('loadPublished', (lessonId: string, versionId?: string) =>
      real.loadPublished(lessonId, versionId),
    ),
    withdraw: wrap('withdraw', (lessonId: string, by: string) => real.withdraw(lessonId, by)),
    restore: wrap('restore', (lessonId: string, by: string) => real.restore(lessonId, by)),
    readRecord: wrap('readRecord', (lessonId: string) => real.readRecord(lessonId), false),
  }
}

/**
 * The editor, its save loop, its report, and its publish flow — mounted together.
 *
 * Together for the reason `editor.tsx` gives at length, and one more this feature adds: publishing
 * *saves first*, so a harness that mounted the publish hook beside a snapshot of the persistence
 * hook would exercise a `saveNow` that writes to a draft nobody is rendering. The ordered flow only
 * means anything when the three hooks see the same session.
 *
 * Nothing waits. The scheduler is hand-advanced and the publishing double answers synchronously.
 */
export interface PublishingHandle {
  readonly session: EditorSession
  readonly persistence: DraftPersistence
  readonly publishing: Publishing
  readonly validation: Validation
  readonly storage: RecordingStorage
  readonly scheduler: TestScheduler
  readonly adapter: RecordingPublishing
}

export interface MountPublishingOptions {
  readonly adapter?: RecordingPublishing
  readonly storage?: RecordingStorage
  readonly scheduler?: TestScheduler
  readonly assets?: AssetAdapter
  readonly elements?: ElementRegistry
  readonly policy?: ValidationPolicy
  readonly by?: string
  /** Render the report and the controls, for the tests that press rather than call. */
  readonly ui?: boolean
}

/** Every asset resolves unless a test says otherwise. */
export const resolvingAssets = (present?: readonly string[]): AssetAdapter => ({
  resolve: async (assetId) =>
    present === undefined || present.includes(assetId)
      ? ({ url: `https://cdn.test/${assetId}` } as AssetLocation)
      : null,
})

export function mountPublishing(manifest: LessonManifest, options: MountPublishingOptions = {}) {
  const adapter = options.adapter ?? recordingPublishing()
  const storage = options.storage ?? recordingStorage()
  const scheduler = options.scheduler ?? testScheduler()
  const holder = {
    session: undefined as unknown as EditorSession,
    persistence: undefined as unknown as DraftPersistence,
    publishing: undefined as unknown as Publishing,
    validation: undefined as unknown as Validation,
    storage,
    scheduler,
    adapter,
  }
  const idSource = countingIds()

  function Harness(): React.ReactNode {
    const session = useEditorSession({ manifest, slideId: manifest.slides[0]!.id, idSource })
    const persistence = useDraftPersistence({
      storage,
      lessonId: 'lesson',
      openedAt: 'v0',
      draft: session.draft,
      scheduler,
      identity: 'teacher',
    })
    const validation = useValidation({
      draft: session.draft,
      goToSlide: session.goToSlide,
      select: session.select,
      ...(options.elements ? { elements: options.elements } : {}),
      ...(options.policy ? { policy: options.policy } : {}),
    })
    const publishing = usePublishing({
      publishing: adapter,
      lessonId: 'lesson',
      draft: session.draft,
      by: options.by ?? 'teacher',
      saveNow: persistence.saveNow,
      ...(options.assets ? { assets: options.assets } : {}),
      ...(options.elements ? { elements: options.elements } : {}),
      ...(options.policy ? { policy: options.policy } : {}),
    })

    holder.session = session
    holder.persistence = persistence
    holder.validation = validation
    holder.publishing = publishing

    if (!options.ui) return null
    return (
      <>
        <ValidationReport report={validation.report} onSelect={validation.jumpTo} />
        <PublishControls publishing={publishing} />
      </>
    )
  }

  const { container, unmount } = render(<Harness />)
  return { handle: holder as PublishingHandle, container, unmount }
}

/** Run a publish attempt to completion without moving the clock. */
export async function attemptPublish(handle: PublishingHandle) {
  let outcome!: Awaited<ReturnType<Publishing['publish']>>
  await act(async () => {
    outcome = await handle.publishing.publish()
  })
  return outcome
}
