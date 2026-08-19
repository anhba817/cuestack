import type { LessonManifest } from '@cuestack/schema'
import { createMemoryPublishing } from '../../src/publishing/memory/index.js'
import type {
  ActionResult,
  LoadPublishedResult,
  PublishRefusal,
  PublishResult,
  PublishedVersion,
  PublishingAdapter,
  RecordEntry,
} from '../../src/publishing/index.js'

export interface Call {
  readonly method: string
  readonly args: readonly unknown[]
}

export interface RecordingPublishing extends PublishingAdapter {
  readonly calls: readonly Call[]
  /** Refuse the next call to any method with this reason, until cleared. */
  refuseWith(reason: PublishRefusal | null): void
}

/**
 * A recording double that **wraps the real reference** rather than replacing it.
 *
 * The distinction matters more than it looks. A hand-written stub answers whatever the test needs,
 * so a test can pass because the double was more forgiving than any real adapter — the freeze that
 * was not applied, the version number that was not sequenced, the record entry that was not
 * appended. Wrapping means every call that is not deliberately refused goes to the implementation
 * whose behaviour the contract describes, and the double only adds the two things a test cannot get
 * from it: a list of what was asked, and a way to make an answer be no.
 */
export function recordingPublishing(inner?: PublishingAdapter): RecordingPublishing {
  const real = inner ?? createMemoryPublishing()
  const calls: Call[] = []
  let refusal: PublishRefusal | null = null

  const record = (method: string, args: readonly unknown[]): void => {
    calls.push({ method, args })
  }

  return {
    calls,
    refuseWith(reason) {
      refusal = reason
    },
    async publish(lessonId: string, manifest: LessonManifest, by: string): Promise<PublishResult> {
      record('publish', [lessonId, manifest, by])
      if (refusal) return { ok: false, reason: refusal }
      return real.publish(lessonId, manifest, by)
    },
    async listPublished(lessonId: string): Promise<readonly PublishedVersion[]> {
      record('listPublished', [lessonId])
      return real.listPublished(lessonId)
    },
    async loadPublished(lessonId: string, versionId?: string): Promise<LoadPublishedResult> {
      record('loadPublished', [lessonId, versionId])
      if (refusal) return { ok: false, reason: refusal }
      return real.loadPublished(lessonId, versionId)
    },
    async withdraw(lessonId: string, by: string): Promise<ActionResult> {
      record('withdraw', [lessonId, by])
      if (refusal) return { ok: false, reason: refusal }
      return real.withdraw(lessonId, by)
    },
    async restore(lessonId: string, by: string): Promise<ActionResult> {
      record('restore', [lessonId, by])
      if (refusal) return { ok: false, reason: refusal }
      return real.restore(lessonId, by)
    },
    async readRecord(lessonId: string): Promise<readonly RecordEntry[]> {
      record('readRecord', [lessonId])
      return real.readRecord(lessonId)
    },
  }
}
