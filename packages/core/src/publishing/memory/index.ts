import type { LessonManifest } from '@cuestack/schema'
import type {
  ActionResult,
  LoadPublishedResult,
  PublishAction,
  PublishResult,
  PublishedVersion,
  PublishedVersionId,
  PublishingAdapter,
  RecordEntry,
} from '../index.js'

/**
 * The in-memory reference for publishing.
 *
 * Product, not scaffolding, for the same reason `createMemoryStorage` is: FR-037 requires the whole
 * feature — validation, refusal, publication, withdrawal, and the record — to be exercisable with no
 * host backend. A host implementing this interface gets a working example of every path rather than
 * of four of six.
 *
 * It enforces what the interface promises rather than merely permitting it: versions are deeply
 * frozen on read, the record refuses to be edited, and there is no code path that changes a version
 * once written.
 */

export interface MemoryPublishingOptions {
  /**
   * The host's clock, injected so `publishedAt` is deterministic in tests.
   *
   * A real host reads its server's clock. The framework never supplies this value — see
   * `PublishedVersion.publishedAt`.
   */
  readonly now?: () => number
}

interface Lesson {
  readonly versions: PublishedVersion[]
  /** Null while withdrawn. Cleared by `withdraw`, not by removing anything. */
  activeId: PublishedVersionId | null
  readonly record: RecordEntry[]
}

/**
 * Deep-freeze, applied on read rather than on write.
 *
 * On read because the object handed out is the one a renderer might mutate, and this framework
 * ships a renderer that takes manifests. Affordable here in a way it would not be for a draft: a
 * published version is read rarely, where a draft is resolved sixty times a second — which is
 * exactly why the draft is deliberately not frozen (research R-05).
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key])
  }
  return value
}

/** A structural clone, so freezing what we stored never freezes what the caller handed in. */
const snapshot = (manifest: LessonManifest): LessonManifest =>
  JSON.parse(JSON.stringify(manifest)) as LessonManifest

export function createMemoryPublishing(options: MemoryPublishingOptions = {}): PublishingAdapter {
  const lessons = new Map<string, Lesson>()
  // Not `Date.now` by default: a fixed origin keeps the reference deterministic even when a caller
  // forgets to inject, and a host that wants real times passes its own.
  const now = options.now ?? (() => 0)

  const append = (lesson: Lesson, action: PublishAction, versionId: string, actor: string): void => {
    lesson.record.push(Object.freeze({ action, versionId, actor, at: now() }))
  }

  return {
    async publish(lessonId, manifest, by): Promise<PublishResult> {
      const lesson = lessons.get(lessonId) ?? { versions: [], activeId: null, record: [] }
      const versionNumber = lesson.versions.length + 1
      const version: PublishedVersion = {
        id: `pub-${versionNumber}`,
        manifest: snapshot(manifest),
        versionNumber,
        publishedBy: by,
        publishedAt: now(),
        schemaVersion: manifest.schemaVersion,
      }
      lesson.versions.push(version)
      // Publishing makes the newest version active. There is deliberately no way to make an
      // arbitrary one active: that would let a host move the pointer with no record of doing so.
      lesson.activeId = version.id
      append(lesson, 'published', version.id, by)
      lessons.set(lessonId, lesson)
      return { ok: true, version: deepFreeze(version) }
    },

    async listPublished(lessonId): Promise<readonly PublishedVersion[]> {
      const lesson = lessons.get(lessonId)
      if (!lesson) return []
      // Newest first, and a copy of the array: a caller sorting the result must not reorder ours.
      return [...lesson.versions].reverse().map(deepFreeze)
    },

    async loadPublished(lessonId, versionId): Promise<LoadPublishedResult> {
      const lesson = lessons.get(lessonId)
      if (!lesson || lesson.versions.length === 0) return { ok: false, reason: 'not_found' }

      if (versionId !== undefined) {
        // A named version is readable while the lesson is withdrawn: withdrawal changes
        // availability, not existence, and a host reconciling what a learner is part-way through
        // needs to be able to read the version they are playing.
        const found = lesson.versions.find((v) => v.id === versionId)
        return found ? { ok: true, version: deepFreeze(found) } : { ok: false, reason: 'not_found' }
      }

      // Withdrawn and not-found are different answers, and the difference is what stops a host
      // telling a learner that a lesson which plainly exists does not (FR-029a).
      if (lesson.activeId === null) return { ok: false, reason: 'withdrawn' }
      const active = lesson.versions.find((v) => v.id === lesson.activeId)
      return active ? { ok: true, version: deepFreeze(active) } : { ok: false, reason: 'not_found' }
    },

    async withdraw(lessonId, by): Promise<ActionResult> {
      const lesson = lessons.get(lessonId)
      if (!lesson || lesson.versions.length === 0) return { ok: false, reason: 'not_found' }
      if (lesson.activeId === null) return { ok: true }
      const withdrawn = lesson.activeId
      lesson.activeId = null
      append(lesson, 'withdrawn', withdrawn, by)
      return { ok: true }
    },

    async restore(lessonId, by): Promise<ActionResult> {
      const lesson = lessons.get(lessonId)
      if (!lesson || lesson.versions.length === 0) return { ok: false, reason: 'not_found' }
      if (lesson.activeId !== null) return { ok: true }
      // The most recent version becomes active again, and no version is created: if withdrawing
      // changed no version, restoring has none to make (FR-031).
      const newest = lesson.versions[lesson.versions.length - 1]!
      lesson.activeId = newest.id
      append(lesson, 'restored', newest.id, by)
      return { ok: true }
    },

    async readRecord(lessonId): Promise<readonly RecordEntry[]> {
      // Frozen, and a frozen *copy*: the caller must not hold a live handle on the record, and an
      // interface that can rewrite history can be asked to.
      return Object.freeze([...(lessons.get(lessonId)?.record ?? [])])
    },
  }
}
