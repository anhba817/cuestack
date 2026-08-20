import type {
  AnalyticsAdapter,
  AssetAdapter,
  LoadResult,
  PublishingAdapter,
  SaveResult,
  StorageAdapter,
} from '@cuestack/core'
import type { OperationMapping } from './mapping.js'
import { perform, type PerformOptions, type PerformResult, type ResponseBody } from './request.js'

type PerformSuccess = ResponseBody
import type { Outcome } from './classify.js'

/**
 * The four contracts, over whatever the host's mapping describes.
 *
 * Each is a thin arrangement: build the request the host described, perform it once, and translate
 * one of four outcomes into the result shape the interface promises. The translation differs per
 * interface because the interfaces differ — `StorageAdapter` distinguishes a conflict, and
 * `PublishingAdapter` distinguishes a withdrawal — and that is the whole of what lives here.
 */

type Runner = <I, O>(op: { request(i: I): unknown; read(r: PerformSuccess): O }, input: I) => Promise<
  { ok: true; value: O } | { ok: false; outcome: Outcome }
>

function runnerFor(options: PerformOptions): Runner {
  return async (op, input) => {
    const result: PerformResult = await perform(
      op.request(input) as Parameters<typeof perform>[0],
      options,
    )
    if (!result.ok) return { ok: false, outcome: result.outcome }
    try {
      return { ok: true, value: op.read(result) }
    } catch {
      /**
       * The host's reader could not make sense of its own server's answer. That is a failure, not a
       * success with a missing value — a save reported as Saved that was not is the outcome
       * FR-DAT-003 exists to prevent (FR-024).
       */
      return { ok: false, outcome: 'unavailable' }
    }
  }
}

/** Storage speaks `unauthorized`/`unavailable`/`not_found`; the four outcomes map onto them. */
const loadReason = (outcome: Outcome): 'not_found' | 'unauthorized' | 'unavailable' =>
  outcome === 'permission' ? 'unauthorized' : outcome === 'not-found' ? 'not_found' : 'unavailable'

export function storageOver(mapping: OperationMapping, options: PerformOptions): StorageAdapter {
  const run = runnerFor(options)
  return {
    async loadDraft(lessonId): Promise<LoadResult> {
      const r = await run(mapping.loadDraft, { lessonId })
      return r.ok
        ? { ok: true, manifest: r.value.manifest, token: r.value.token }
        : { ok: false, reason: loadReason(r.outcome) }
    },
    async saveDraft(lessonId, manifest, token, saveOptions): Promise<SaveResult> {
      const r = await run(mapping.saveDraft, { lessonId, manifest, token, options: saveOptions })
      if (r.ok) return { ok: true, token: r.value.token }
      /**
       * A conflict is not a failure, and the difference is the only thing standing between two
       * teachers editing one lesson and one of them losing an afternoon. The conflict case is in
       * `SaveResult` precisely so a host cannot accidentally implement last-writer-wins.
       */
      if (r.outcome === 'conflict') {
        const current = await run(mapping.loadDraft, { lessonId })
        return { ok: false, reason: 'conflict', currentToken: current.ok ? current.value.token : token }
      }
      return { ok: false, reason: r.outcome === 'permission' ? 'unauthorized' : 'unavailable' }
    },
    async listVersions(lessonId) {
      const r = await run(mapping.listVersions, { lessonId })
      // The history being unreachable is not the history being empty, and an empty list would be a
      // lie the editor would render as "no earlier versions" (feature 008, FR-043).
      if (!r.ok) throw new Error('The version history could not be reached.')
      return r.value
    },
    async loadVersion(lessonId, token): Promise<LoadResult> {
      const r = await run(mapping.loadVersion, { lessonId, token })
      return r.ok
        ? { ok: true, manifest: r.value.manifest, token: r.value.token }
        : { ok: false, reason: loadReason(r.outcome) }
    },
  }
}

export function assetsOver(mapping: OperationMapping, options: PerformOptions): AssetAdapter {
  const run = runnerFor(options)
  return {
    async resolve(assetId) {
      const r = await run(mapping.resolveAsset, { assetId })
      // An asset that cannot be resolved and one the server will not talk about are the same answer
      // to a renderer: there is no address.
      return r.ok ? r.value : null
    },
  }
}

export function analyticsOver(mapping: OperationMapping, options: PerformOptions): AnalyticsAdapter {
  const run = runnerFor(options)
  return {
    record(event) {
      /**
       * Fire-and-forget is **forced by the signature**, not chosen: `record` returns `void`, so
       * there is nowhere to put a promise and no way to report a failure.
       *
       * That makes one thing non-negotiable — the rejection is caught here. A dropped promise is a
       * process-level warning or a crash depending on how the runtime is configured, which would be
       * this operation interrupting a lesson by exactly the route it exists to avoid.
       */
      void run(mapping.recordEvent, { event }).catch(() => undefined)
    },
  }
}

export function publishingOver(mapping: OperationMapping, options: PerformOptions): PublishingAdapter {
  const run = runnerFor(options)
  const refusal = (outcome: Outcome) =>
    outcome === 'permission'
      ? ('permission' as const)
      : outcome === 'not-found'
        ? ('not_found' as const)
        : outcome === 'conflict'
          ? ('conflict' as const)
          : ('unavailable' as const)

  return {
    async publish(lessonId, manifest, by) {
      const r = await run(mapping.publish, { lessonId, manifest, by })
      return r.ok ? { ok: true, version: r.value } : { ok: false, reason: refusal(r.outcome) }
    },
    async listPublished(lessonId) {
      const r = await run(mapping.listPublished, { lessonId })
      return r.ok ? r.value : []
    },
    async loadPublished(lessonId, versionId) {
      const spec = mapping.loadPublished.request({ lessonId, versionId })
      const response = await perform(spec, options)
      if (response.ok) {
        try {
          return { ok: true, version: mapping.loadPublished.read(response) }
        } catch {
          return { ok: false, reason: 'unavailable' }
        }
      }
      const r = { ok: false as const, outcome: response.outcome }
      const seen = response.response
      /**
       * `not-found` is where withdrawn arrives, and the host's classifier is what distinguishes
       * them — a shape that signals a withdrawal as 410 gets `not-found` here unless it says
       * otherwise. The contract makes that the host's responsibility and says what breaks when it
       * is not preserved: a teacher shown a broken link where they should see a lesson they took
       * down.
       */
      /**
       * A withdrawal arrives as an absence, and only the host's API can say which kind it is.
       * Asked here rather than inferred, because inferring would mean reading a status code we
       * have no business having an opinion about.
       */
      if (r.outcome === 'not-found' && seen && mapping.loadPublished.isWithdrawn?.(seen)) {
        return { ok: false, reason: 'withdrawn' }
      }
      return { ok: false, reason: refusal(r.outcome) }
    },
    async withdraw(lessonId, by) {
      const r = await run(mapping.withdraw, { lessonId, by })
      return r.ok ? { ok: true } : { ok: false, reason: refusal(r.outcome) }
    },
    async restore(lessonId, by) {
      const r = await run(mapping.restore, { lessonId, by })
      return r.ok ? { ok: true } : { ok: false, reason: refusal(r.outcome) }
    },
    async readRecord(lessonId) {
      const r = await run(mapping.readRecord, { lessonId })
      return r.ok ? r.value : []
    },
  }
}
