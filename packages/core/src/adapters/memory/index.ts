import type { LessonManifest } from '@cuestack/schema'
import type {
  AnalyticsAdapter,
  AssetAdapter,
  LessonEvent,
  LoadResult,
  SaveResult,
  StorageAdapter,
  VersionSummary,
  VersionToken,
} from '../index.js'

/**
 * The in-memory reference. Product, not test scaffolding: FR-032 requires the
 * framework to work with no host code at all, so resolve() and playback can be
 * exercised — and the Next.js example can run — before anyone writes a backend.
 *
 * Its storage issues real incrementing tokens and genuinely rejects stale saves,
 * so the conflict path is exercised by default rather than only in whatever the
 * first real host gets round to implementing.
 */

interface Stored {
  manifest: LessonManifest
  version: number
}

export function createMemoryStorage(): StorageAdapter & { seed(id: string, m: LessonManifest): void } {
  const store = new Map<string, Stored>()
  const tokenOf = (version: number): VersionToken => `v${version}`

  return {
    seed(id, manifest) {
      store.set(id, { manifest, version: 1 })
    },
    async loadDraft(lessonId): Promise<LoadResult> {
      const found = store.get(lessonId)
      if (!found) return { ok: false, reason: 'not_found' }
      return { ok: true, manifest: found.manifest, token: tokenOf(found.version) }
    },
    async saveDraft(lessonId, manifest, token): Promise<SaveResult> {
      const found = store.get(lessonId)
      if (!found) {
        store.set(lessonId, { manifest, version: 1 })
        return { ok: true, token: tokenOf(1) }
      }
      if (token !== tokenOf(found.version)) {
        // The stored manifest is deliberately left untouched.
        return { ok: false, reason: 'conflict', currentToken: tokenOf(found.version) }
      }
      const version = found.version + 1
      store.set(lessonId, { manifest, version })
      return { ok: true, token: tokenOf(version) }
    },
    async listVersions(lessonId): Promise<readonly VersionSummary[]> {
      const found = store.get(lessonId)
      if (!found) return []
      return Array.from({ length: found.version }, (_, i) => ({
        token: tokenOf(i + 1),
        versionNumber: i + 1,
      }))
    },
  }
}

export function createMemoryAssets(): AssetAdapter {
  return {
    async resolve(assetId) {
      return { url: `memory://asset/${assetId}` }
    },
  }
}

export function createMemoryAnalytics(): AnalyticsAdapter & { events: LessonEvent[] } {
  const events: LessonEvent[] = []
  return {
    events,
    record(event) {
      events.push(event)
    },
  }
}

/** All three, ready to use. */
export function memoryAdapters() {
  return {
    storage: createMemoryStorage(),
    assets: createMemoryAssets(),
    analytics: createMemoryAnalytics(),
  }
}
