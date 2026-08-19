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

/**
 * One checkpoint of a draft — not one save.
 *
 * Renamed from `VersionSummary` in feature 008, because it now describes a checkpoint rather
 * than every acknowledged write, and a summary of nothing was a poor name for it.
 *
 * The separation is what makes FR-DAT-006 and FR-DAT-008 satisfiable at once. Every save must
 * advance the token or a conflict cannot be detected; only a checkpoint may add an entry here,
 * or an hour of autosaving at 1.5-second intervals produces hundreds of indistinguishable rows
 * and the history stops being something a person can read.
 */
export interface VersionEntry {
  readonly token: VersionToken
  readonly versionNumber: number
  /**
   * Epoch milliseconds, stamped by the **host**.
   *
   * The framework never supplies this. The host's storage is the only participant with an
   * authoritative wall clock, a framework-side stamp would disagree between two browsers, and
   * the editor is forbidden from reading a clock at all (`no-clock-in-studio`). `VersionToken`
   * already refuses timestamps as tokens for the related reason stated above.
   */
  readonly recordedAt: number
  /** Present only when the teacher named this checkpoint. */
  readonly label?: string
}

/** What a save may ask the history to record. */
export interface SaveOptions {
  /**
   * Record this save in the version history. Absent means an ordinary autosave.
   *
   * The framework decides, because it owns the checkpoint policy; the host records, because
   * only the host has a history. A save without this still saves — it is absent from the
   * history, not absent from storage.
   */
  readonly checkpoint?: { readonly label?: string }
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
  /**
   * Save, carrying the version the caller last knew about.
   *
   * `options` is additive and optional: an adapter written before feature 008 keeps compiling
   * and keeps working, recording no checkpoints. Every call advances the token whether or not
   * it is a checkpoint, and a call that records no checkpoint **still persists the manifest** —
   * `loadDraft` must return it afterwards. An adapter treating a non-checkpoint save as a no-op
   * would pass every history test and lose an hour of work.
   */
  saveDraft(
    lessonId: string,
    manifest: LessonManifest,
    token: VersionToken,
    options?: SaveOptions,
  ): Promise<SaveResult>
  /** The checkpoints, oldest first. Never one entry per save. */
  listVersions(lessonId: string): Promise<readonly VersionEntry[]>
  /**
   * The content of a named earlier version.
   *
   * Added in feature 008, and the gap it closes was not difficulty but impossibility:
   * FR-DAT-009 asks a teacher to restore an earlier draft and this interface could load only
   * the current one.
   *
   * **The token it returns is the current draft's, not the loaded version's.** What comes back
   * is content to be saved forward as a *new* version (FR-DAT-010); returning the old token
   * would make the very next save look like a conflict. That single sentence is why restoring
   * is additive rather than destructive, and it is the easiest thing here to get subtly wrong.
   */
  loadVersion(lessonId: string, token: VersionToken): Promise<LoadResult>
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
    /**
     * Authoring, added in feature 005.
     *
     * FR-AN-001 has always declared that the authoring application emits events for element
     * insertion, but this union modelled only playback — so FR-048 had a requirement and
     * nothing to emit. Added here rather than as a parallel event type in the editor because
     * FR-AN-005 specifies *one* replaceable analytics adapter: a host should implement
     * `record` once, not once per surface.
     *
     * Additive to a type no manifest serializes and no playback path branches on, so it
     * carries no `schemaVersion` implication.
     */
    | 'element_inserted'
  readonly lessonId: string
  readonly schemaVersion: string
  readonly slideId?: string
  readonly interactionId?: string
  readonly attempt?: number
  readonly outcome?: 'correct' | 'incorrect' | 'skipped'
  /** Which type was inserted. A format value — never anything about who inserted it. */
  readonly elementType?: string
}

/** Fire and forget: returns void, never throws, never awaited. Analytics must not
 *  be able to stall playback or fail a lesson. */
export interface AnalyticsAdapter {
  record(event: LessonEvent): void
}
