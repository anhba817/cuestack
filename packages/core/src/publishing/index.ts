import type { LessonManifest } from '@cuestack/schema'

/**
 * The fourth adapter, and the boundary where a lesson stops being the author's.
 *
 * Beside `StorageAdapter`, `AssetAdapter`, and `AnalyticsAdapter` rather than folded into the
 * first, because a draft and a published version have **opposite lifetimes**: one changes every
 * 1.5 seconds, the other must never change again. EN-6 divided adapters by capability, and
 * publishing is a capability a host may genuinely not have — an editor embedded in an LMS that
 * publishes through its own workflow needs storage and no publishing at all.
 *
 * **Note what is absent, permanently.** There is no method that updates a published version, none
 * that deletes one, none that edits the record, and none that makes an arbitrary version active.
 * In a file this size the absence is visible; in one of ten methods, six of which write, it would
 * be a convention waiting to be broken by somebody in a hurry. That is EN-6's own argument about
 * the conflict token, applied again: putting a rule in the *interface* makes it a property of the
 * framework rather than a hope about the host's endpoint (BR-008, research R-04).
 *
 * Deliberately **not** a member of `Ports`. Playback never publishes, and that interface's comment
 * gives the rule — "adding a port is then a visible change at every construction site, rather than
 * a quiet new obligation."
 */

/** Opaque, host-assigned, and stable forever. What FR-027 puts behind a host's URL. */
export type PublishedVersionId = string

export interface PublishedVersion {
  readonly id: PublishedVersionId
  /** Deeply frozen on read. The framework offers no way to change it (BR-008). */
  readonly manifest: LessonManifest
  readonly versionNumber: number
  /** The host's identity for whoever published. The framework holds no roles. */
  readonly publishedBy: string
  /** Epoch milliseconds, stamped by the host — the only participant with an authoritative clock. */
  readonly publishedAt: number
  /**
   * The format it was published under, kept so it can be honoured rather than upgraded.
   *
   * A published version plays as published. Bringing it forward would change what a learner
   * receives, which is the one thing BR-008 forbids — so this is a standing constraint on future
   * migrations rather than on this feature (FR-023).
   */
  readonly schemaVersion: string
}

export type PublishAction = 'published' | 'withdrawn' | 'restored'

export interface RecordEntry {
  readonly action: PublishAction
  readonly versionId: PublishedVersionId
  readonly actor: string
  readonly at: number
}

/** Why something did not happen. Every one of these is an ordinary answer, not an exception. */
export type PublishRefusal = 'permission' | 'unavailable' | 'conflict' | 'not_found'

export type PublishResult =
  | { readonly ok: true; readonly version: PublishedVersion }
  | { readonly ok: false; readonly reason: PublishRefusal }

/**
 * Three answers, and the third is the one hosts get wrong.
 *
 * `withdrawn` and `not_found` must be distinguishable: a host that cannot tell them apart shows a
 * learner "this lesson does not exist" about a lesson that plainly does (FR-029a).
 */
export type LoadPublishedResult =
  | { readonly ok: true; readonly version: PublishedVersion }
  | { readonly ok: false; readonly reason: 'withdrawn' | PublishRefusal }

export type ActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: PublishRefusal }

export interface PublishingAdapter {
  /**
   * Publish the manifest as a new immutable version.
   *
   * `by` is the host's identity for whoever is acting. The framework does not know who anybody is
   * and does not decide what they may do — it asks by attempting, and a `permission` refusal is one
   * of the answers (FR-032a).
   */
  publish(lessonId: string, manifest: LessonManifest, by: string): Promise<PublishResult>
  /** Newest first. Never loads a version's content. */
  listPublished(lessonId: string): Promise<readonly PublishedVersion[]>
  /** The active version when no id is given. */
  loadPublished(lessonId: string, versionId?: PublishedVersionId): Promise<LoadPublishedResult>
  /** Clears the active version. Deletes nothing (FR-030). */
  withdraw(lessonId: string, by: string): Promise<ActionResult>
  /** Makes the most recent version active again. Creates none (FR-031). */
  restore(lessonId: string, by: string): Promise<ActionResult>
  /** Oldest first. Append-only: nothing here can alter or remove an entry (FR-034). */
  readRecord(lessonId: string): Promise<readonly RecordEntry[]>
}
