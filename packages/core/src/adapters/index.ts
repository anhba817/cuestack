import type { LessonManifest } from '@cuestack/schema'

/** Opaque. An ETag, a row version, a vector clock, and a content hash are all
 *  valid, and the kernel has no basis for preferring one. Explicitly not a
 *  timestamp: that needs synchronised clocks and reintroduces nondeterminism. */
export type VersionToken = string

export type LoadResult =
  | { readonly ok: true; readonly manifest: LessonManifest; readonly token: VersionToken }
  | { readonly ok: false; readonly reason: 'not_found' | 'unauthorized' | 'unavailable' }

export type SaveResult =
  | { readonly ok: true; readonly token: VersionToken }
  | { readonly ok: false; readonly reason: 'conflict'; readonly currentToken: VersionToken }
  | { readonly ok: false; readonly reason: 'unauthorized' | 'unavailable' }

export interface VersionSummary {
  readonly token: VersionToken
  readonly versionNumber: number
}

/**
 * The conflict path is in the signature, not in a convention.
 *
 * `saveDraft` cannot be called without a token, and `SaveResult` has a conflict
 * case a caller must handle — so a host cannot accidentally implement
 * last-writer-wins, because there is nowhere to put the token that isn't the
 * check (FR-031, research R-08).
 *
 * Every method returns a result rather than throwing: storage failure is an
 * expected condition in an editor that autosaves.
 */
export interface StorageAdapter {
  loadDraft(lessonId: string): Promise<LoadResult>
  saveDraft(lessonId: string, manifest: LessonManifest, token: VersionToken): Promise<SaveResult>
  listVersions(lessonId: string): Promise<readonly VersionSummary[]>
}

export interface AssetLocation {
  readonly url: string
}

export interface AssetAdapter {
  resolve(assetId: string): Promise<AssetLocation | null>
}

/**
 * Note what is absent: there is no field a learner identifier could occupy
 * (FR-033, NFR-PRV-002). A host wanting attribution supplies it through its own
 * transport. Enforcing that structurally beats enforcing it by review.
 */
export interface LessonEvent {
  readonly kind:
    | 'lesson_started'
    | 'slide_started'
    | 'slide_completed'
    | 'interaction_submitted'
    | 'lesson_paused'
    | 'lesson_resumed'
    | 'lesson_completed'
  readonly lessonId: string
  readonly schemaVersion: string
  readonly slideId?: string
  readonly interactionId?: string
  readonly attempt?: number
  readonly outcome?: 'correct' | 'incorrect' | 'skipped'
}

/** Fire and forget: returns void, never throws, never awaited. Analytics must not
 *  be able to stall playback or fail a lesson. */
export interface AnalyticsAdapter {
  record(event: LessonEvent): void
}
