import type { LessonManifest } from '@cuestack/schema'
import type {
  AssetLocation,
  LessonEvent,
  PublishedVersion,
  RecordEntry,
  SaveOptions,
  VersionEntry,
  VersionToken,
} from '@cuestack/core'
import type { RequestSpec, ResponseBody } from './request.js'

/**
 * What a host says about its own API — and what it does **not** have to say.
 *
 * The framework describes, per operation, what needs sending and what must be learned back. Where
 * that lives, what it is called, and what shape the answer takes are the host's, because the
 * framework does not know their API and will not pretend to (FR-019).
 *
 * **Two halves per operation, and both are the host's.** `request` builds the call; `read` turns the
 * answer into the value the interface promises. If the framework read the body it would be imposing
 * a response shape, which is a route mapping wearing a different hat.
 *
 * What the adapter keeps is everything that is the same for every host: performing the call once,
 * threading credentials, honouring cancellation, and turning a response into one of four meanings.
 */

export interface Operation<Input, Output> {
  request(input: Input): RequestSpec
  /**
   * Turns the answer into the value the interface promises.
   *
   * Takes the whole response rather than the body alone, because a version token may travel in a
   * header — ETag-shaped concurrency is ordinary, and a reader given only the body could not serve
   * it. The framework still reads nothing itself: imposing a body shape would be a route mapping
   * wearing a different hat.
   */
  read(response: ResponseBody): Output
}

export interface LoadDraftOut {
  readonly manifest: LessonManifest
  readonly token: VersionToken
}

export interface SaveDraftIn {
  readonly lessonId: string
  readonly manifest: LessonManifest
  readonly token: VersionToken
  readonly options: SaveOptions | undefined
}

export interface OperationMapping {
  readonly loadDraft: Operation<{ lessonId: string }, LoadDraftOut>
  readonly saveDraft: Operation<SaveDraftIn, { readonly token: VersionToken }>
  readonly listVersions: Operation<{ lessonId: string }, readonly VersionEntry[]>
  readonly loadVersion: Operation<{ lessonId: string; token: VersionToken }, LoadDraftOut>
  readonly resolveAsset: Operation<{ assetId: string }, AssetLocation | null>
  readonly recordEvent: Operation<{ event: LessonEvent }, void>
  readonly publish: Operation<
    { lessonId: string; manifest: LessonManifest; by: string },
    PublishedVersion
  >
  readonly listPublished: Operation<{ lessonId: string }, readonly PublishedVersion[]>
  readonly loadPublished: Operation<
    { lessonId: string; versionId: string | undefined },
    PublishedVersion
  > & {
    /**
     * Whether an absence is a **withdrawal** rather than a nothing-here.
     *
     * The host's, because only the host's API knows how it says so — 410, a 404 with a flag, a 200
     * carrying a status field. Consulted when the outcome is `not-found`, so the four outcomes stay
     * four (FR-022) and the distinction still survives.
     *
     * It matters because one says a decision was made and can be reversed, and the other says there
     * is nothing here. A host that collapses them shows a teacher a broken link where it should show
     * them a lesson they took down (FR-029a).
     */
    isWithdrawn?(response: { status: number; body: unknown }): boolean
  }
  readonly withdraw: Operation<{ lessonId: string; by: string }, void>
  readonly restore: Operation<{ lessonId: string; by: string }, void>
  readonly readRecord: Operation<{ lessonId: string }, readonly RecordEntry[]>
}

/** Every operation, so a missing one is found by name rather than by absence. */
export const OPERATIONS: readonly (keyof OperationMapping)[] = [
  'loadDraft',
  'saveDraft',
  'listVersions',
  'loadVersion',
  'resolveAsset',
  'recordEvent',
  'publish',
  'listPublished',
  'loadPublished',
  'withdraw',
  'restore',
  'readRecord',
]

/**
 * Checked whole, at construction.
 *
 * FR-019a: an operation nobody described is reported now rather than at the moment a teacher uses
 * it. A mapping discovered to be incomplete an hour into somebody's work is the worst moment to
 * discover it — and **every** missing operation is named, not the first, because a host fixing them
 * one build at a time learns the same lesson twelve times.
 */
export function assertComplete(mapping: Partial<OperationMapping>): asserts mapping is OperationMapping {
  const missing = OPERATIONS.filter((op) => {
    const entry = mapping[op] as Operation<unknown, unknown> | undefined
    return typeof entry?.request !== 'function' || typeof entry?.read !== 'function'
  })

  if (missing.length > 0) {
    throw new Error(
      `The HTTP adapter's mapping is incomplete: ${missing.join(', ')} ${
        missing.length === 1 ? 'is' : 'are'
      } missing a request builder, a reader, or both. Every operation must be described before any ` +
        'is used — an editor that discovered this while somebody was working would have nothing to ' +
        'offer them.',
    )
  }
}
