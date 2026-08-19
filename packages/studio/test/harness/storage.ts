import type { LessonManifest } from '@cuestack/schema'
import type { LoadResult, SaveOptions, SaveResult, StorageAdapter, VersionEntry, VersionToken } from '@cuestack/core'
import { createMemoryStorage } from '@cuestack/core'

/**
 * A storage adapter that records what it was asked and can be told to refuse.
 *
 * Written against the **extended** boundary — `SaveOptions`, `VersionEntry`, `loadVersion` —
 * so it does not typecheck until T011 lands. That is deliberate: a double built against the
 * old interface would compile today and break the moment the boundary changed, which is a
 * worse place to find out.
 *
 * It wraps the real in-memory reference rather than faking one. Every assertion about
 * conflicts, checkpoints, and version loading then runs against the same code a host studies
 * as the worked example, so a test cannot pass because the double was more forgiving than
 * the thing it stands in for.
 */
export interface RecordingStorage extends StorageAdapter {
  readonly saves: {
    lessonId: string
    manifest: LessonManifest
    token: VersionToken
    options: SaveOptions | undefined
  }[]
  /** Refuse every call with this reason until told otherwise. */
  fail(reason: 'unavailable' | 'unauthorized' | null): void
  /** Hold the next acknowledgement open. Call `release()` to let it land. */
  hold(): { release(): void }
  /** Write behind the editor's back, the way a colleague's save does. */
  clobber(manifest: LessonManifest): Promise<void>
  seed(lessonId: string, manifest: LessonManifest): void
}

export function recordingStorage(now: () => number = () => 1_700_000_000_000): RecordingStorage {
  const real = createMemoryStorage({ now })
  const saves: RecordingStorage['saves'] = []
  let failure: 'unavailable' | 'unauthorized' | null = null
  let gate: Promise<void> | null = null
  let open: (() => void) | null = null

  const wait = async (): Promise<void> => {
    if (gate) await gate
  }

  return {
    saves,
    fail(reason) {
      failure = reason
    },
    hold() {
      gate = new Promise<void>((resolve) => {
        open = resolve
      })
      return {
        release() {
          const resolve = open
          gate = null
          open = null
          resolve?.()
        },
      }
    },
    async clobber(manifest) {
      const current = await real.loadDraft('lesson')
      const token = current.ok ? current.token : 'unset'
      await real.saveDraft('lesson', manifest, token)
    },
    seed(lessonId, manifest) {
      real.seed(lessonId, manifest)
    },
    async loadDraft(lessonId): Promise<LoadResult> {
      if (failure) return { ok: false, reason: failure }
      return real.loadDraft(lessonId)
    },
    async saveDraft(lessonId, manifest, token, options): Promise<SaveResult> {
      saves.push({ lessonId, manifest, token, options })
      await wait()
      if (failure) return { ok: false, reason: failure }
      return real.saveDraft(lessonId, manifest, token, options)
    },
    async listVersions(lessonId): Promise<readonly VersionEntry[]> {
      if (failure) return []
      return real.listVersions(lessonId)
    },
    async loadVersion(lessonId, token): Promise<LoadResult> {
      if (failure) return { ok: false, reason: failure }
      return real.loadVersion(lessonId, token)
    },
  }
}
