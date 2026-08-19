import { useCallback, useState } from 'react'
import type { LessonManifest } from '@cuestack/schema'
import {
  checkAssets,
  checkLesson,
  collectAssetRefs,
  type AssetAdapter,
  type CheckOptions,
  type PublishingAdapter,
  type PublishedVersion,
  type ReportIssue,
  type ValidationReport,
} from '@cuestack/core'
import type { SaveOutcome } from '../persistence/useDraftPersistence.js'

/**
 * Why a publish did not happen — and every one of these is a different sentence to a teacher.
 *
 * The distinction is the requirement, not a nicety. A teacher told "could not publish" about a
 * network failure searches their lesson for a fault that is not there, and finds one eventually
 * because every lesson has something. `save-failed` is not `invalid`; `permission` is not
 * `unavailable`; and none of them is about the lesson except `invalid` and `assets`.
 */
export type PublishRefusalReason =
  | 'save-failed'
  | 'invalid'
  | 'assets'
  | 'permission'
  | 'unavailable'
  | 'conflict'
  | 'not_found'

export type PublishOutcome =
  | { readonly ok: true; readonly version: PublishedVersion }
  | {
      readonly ok: false
      readonly reason: PublishRefusalReason
      /** Present for `invalid`: the errors that stopped it, so the teacher can act. */
      readonly issues?: readonly ReportIssue[]
      /** Present for `assets`: the ids that could not be resolved, named (BR-018). */
      readonly assetIds?: readonly string[]
      readonly message: string
    }

export interface UsePublishingOptions extends CheckOptions {
  readonly publishing: PublishingAdapter
  readonly lessonId: string
  readonly draft: LessonManifest
  /** The host's identity for whoever is publishing (FR-022). The framework holds no roles. */
  readonly by: string
  /** FR-018a: publishing saves first, and publishes what was saved. */
  readonly saveNow: () => Promise<SaveOutcome>
  /** Optional: without one, the asset step is skipped rather than assumed to pass. */
  readonly assets?: AssetAdapter
}

export interface Publishing {
  /** Null until a publish has been attempted. */
  readonly outcome: PublishOutcome | null
  readonly busy: boolean
  /** The report the last attempt produced, kept so the refusal can be read beside it. */
  readonly report: ValidationReport | null
  publish(): Promise<PublishOutcome>
  withdraw(): Promise<PublishOutcome | { ok: boolean; reason?: string }>
  restore(): Promise<PublishOutcome | { ok: boolean; reason?: string }>
}

const REFUSAL_TEXT: Record<PublishRefusalReason, string> = {
  'save-failed':
    'Your latest changes could not be saved, so there was nothing settled to publish. Nothing was ' +
    'published and your lesson is untouched — check your connection and try again.',
  invalid:
    'This lesson has errors that would reach a learner, so it was not published. Fix the errors ' +
    'listed below and publish again.',
  assets:
    'This lesson uses files that could not be found, so it was not published. A learner would see ' +
    'a gap where they should be.',
  permission: 'You do not have permission to publish this lesson. Nothing was published.',
  unavailable:
    'Publishing is unreachable at the moment. Nothing was published and your lesson is unchanged — ' +
    'try again shortly.',
  conflict:
    'Someone else changed this lesson while you were publishing. Nothing was published. Reload to ' +
    'see their version before publishing yours.',
  not_found: 'This lesson could not be found in the publishing store. Nothing was published.',
}

/**
 * The ordered flow from the publishing contract §6, and the order is the design.
 *
 * ```
 * 1. saveNow()                  — and publish only if it lands (FR-018a)
 * 2. checkLesson(draft, policy) — freshly, never a cached report (FR-015)
 * 3. any error   -> refuse, naming them
 * 4. checkAssets(collectAssetRefs(draft))
 * 5. any missing -> refuse, naming them (BR-018)
 * 6. publish()
 * ```
 *
 * **Every refusal changes nothing** (FR-017). That is a property of this arrangement rather than
 * of any cleanup: nothing here writes to the draft, and the only write anywhere is step 1's save,
 * which happens before any refusal can occur and is the state the teacher already asked for.
 *
 * **Step 2 does not trust an earlier report.** The draft may have moved since one was produced,
 * and a report costs a millisecond. Trusting a stale one is how a lesson gets published carrying
 * the error it was just shown to have.
 */
export function usePublishing(options: UsePublishingOptions): Publishing {
  const { publishing, lessonId, draft, by, saveNow, assets, elements, effects, policy } = options
  const [outcome, setOutcome] = useState<PublishOutcome | null>(null)
  const [report, setReport] = useState<ValidationReport | null>(null)
  const [busy, setBusy] = useState(false)

  const refuse = useCallback(
    (
      reason: PublishRefusalReason,
      extra: { issues?: readonly ReportIssue[]; assetIds?: readonly string[] } = {},
    ): PublishOutcome => {
      const result: PublishOutcome = { ok: false, reason, message: REFUSAL_TEXT[reason], ...extra }
      setOutcome(result)
      return result
    },
    [],
  )

  const publish = useCallback(async (): Promise<PublishOutcome> => {
    setBusy(true)
    try {
      const saved = await saveNow()
      if (!saved.ok) return refuse(saved.reason === 'conflict' ? 'conflict' : 'save-failed')

      const fresh = checkLesson(draft, { elements, effects, policy })
      setReport(fresh)
      if (fresh.blocks) {
        return refuse('invalid', { issues: fresh.issues.filter((i) => i.severity === 'error') })
      }

      if (assets) {
        const unresolved = await checkAssets(collectAssetRefs(draft), assets)
        if (unresolved.length > 0) {
          return refuse('assets', { assetIds: [...new Set(unresolved.map((u) => u.assetId))] })
        }
      }

      const result = await publishing.publish(lessonId, draft, by)
      if (!result.ok) return refuse(result.reason)

      const success: PublishOutcome = { ok: true, version: result.version }
      setOutcome(success)
      return success
    } finally {
      setBusy(false)
    }
  }, [saveNow, refuse, draft, elements, effects, policy, assets, publishing, lessonId, by])

  const act = useCallback(
    async (which: 'withdraw' | 'restore') => {
      setBusy(true)
      try {
        const result = await publishing[which](lessonId, by)
        if (!result.ok) {
          setOutcome({ ok: false, reason: result.reason, message: REFUSAL_TEXT[result.reason] })
          return { ok: false, reason: result.reason }
        }
        setOutcome(null)
        return { ok: true }
      } finally {
        setBusy(false)
      }
    },
    [publishing, lessonId, by],
  )

  return {
    outcome,
    busy,
    report,
    publish,
    withdraw: () => act('withdraw'),
    restore: () => act('restore'),
  }
}
