import type { LessonManifest } from '@cuestack/schema'
import type {
  AnalyticsAdapter,
  AssetAdapter,
  LessonEvent,
  LoadResult,
  SaveOptions,
  SaveResult,
  StorageAdapter,
  VersionEntry,
  VersionToken,
} from '../index.js'

/**
 * The in-memory reference. Product, not test scaffolding: FR-032 requires the
 * framework to work with no host code at all, so resolve() and playback can be
 * exercised — and the Next.js example can run — before anyone writes a backend.
 *
 * Its storage issues real incrementing tokens and genuinely rejects stale saves,
 * so the conflict path is exercised by default rather than only in whatever the
 * first real host gets round to implementing. Feature 008 extends the same
 * principle to checkpoints and version loading: every path a host must implement
 * has a working example here rather than three of five.
 */

interface Stored {
  manifest: LessonManifest
  version: number
  /** The content at each checkpoint, keyed by the token it was written under. */
  history: { entry: VersionEntry; manifest: LessonManifest }[]
  /** Every version's content, so `loadVersion` can answer for any token issued. */
  byToken: Map<VersionToken, LessonManifest>
}

export interface MemoryStorageOptions {
  /**
   * The host's clock, injected so `recordedAt` is deterministic in tests.
   *
   * A real host reads its server's clock here. The framework never supplies this value —
   * see `VersionEntry.recordedAt`.
   */
  readonly now?: () => number
}

export function createMemoryStorage(
  options: MemoryStorageOptions = {},
): StorageAdapter & { seed(id: string, m: LessonManifest): void } {
  const store = new Map<string, Stored>()
  const tokenOf = (version: number): VersionToken => `v${version}`
  // Not `Date.now` by default: a fixed origin keeps the reference deterministic even when a
  // caller forgets to inject, and a host that wants real times passes its own.
  const now = options.now ?? (() => 0)

  const put = (
    lessonId: string,
    manifest: LessonManifest,
    version: number,
    prior: Stored | undefined,
    checkpoint: SaveOptions['checkpoint'],
  ): void => {
    const record: Stored = prior ?? { manifest, version, history: [], byToken: new Map() }
    record.manifest = manifest
    record.version = version
    record.byToken.set(tokenOf(version), manifest)
    if (checkpoint) {
      const entry: VersionEntry = {
        token: tokenOf(version),
        versionNumber: record.history.length + 1,
        recordedAt: now(),
        ...(checkpoint.label !== undefined ? { label: checkpoint.label } : {}),
      }
      record.history.push({ entry, manifest })
    }
    store.set(lessonId, record)
  }

  return {
    seed(id, manifest) {
      put(id, manifest, 1, undefined, undefined)
    },
    async loadDraft(lessonId): Promise<LoadResult> {
      const found = store.get(lessonId)
      if (!found) return { ok: false, reason: 'not_found' }
      return { ok: true, manifest: found.manifest, token: tokenOf(found.version) }
    },
    async saveDraft(lessonId, manifest, token, saveOptions): Promise<SaveResult> {
      const found = store.get(lessonId)
      if (!found) {
        put(lessonId, manifest, 1, undefined, saveOptions?.checkpoint)
        return { ok: true, token: tokenOf(1) }
      }
      if (token !== tokenOf(found.version)) {
        // The stored manifest is deliberately left untouched, and nothing is recorded on the
        // way out: a refused save must not appear in the history it was refused from.
        return { ok: false, reason: 'conflict', currentToken: tokenOf(found.version) }
      }
      // Advances the version whether or not it is a checkpoint. A save that records no
      // history entry is still a save — absent from the history, not absent from storage.
      //
      // The version is captured before `put` runs: `put` mutates the same record object, so
      // reading `found.version` afterwards yields the already-incremented value and the
      // returned token would be one ahead of the one actually stored.
      const next = found.version + 1
      put(lessonId, manifest, next, found, saveOptions?.checkpoint)
      return { ok: true, token: tokenOf(next) }
    },
    async listVersions(lessonId): Promise<readonly VersionEntry[]> {
      return store.get(lessonId)?.history.map((h) => h.entry) ?? []
    },
    async loadVersion(lessonId, token): Promise<LoadResult> {
      const found = store.get(lessonId)
      if (!found) return { ok: false, reason: 'not_found' }
      const manifest = found.byToken.get(token)
      if (!manifest) return { ok: false, reason: 'not_found' }
      // The CURRENT token, not the loaded version's: what comes back is content to be saved
      // forward as a new version, and the old token would make that save a conflict.
      return { ok: true, manifest, token: tokenOf(found.version) }
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
