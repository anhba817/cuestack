import type { LessonManifest } from '@cuestack/schema'
import type { VersionToken } from '@cuestack/core'

/**
 * Where unsaved work waits out an interruption.
 *
 * A port rather than a direct `localStorage` call, for two reasons that both matter. A test
 * drives a double instead of a browser global, and — the one that decides the design —
 * **the absence of an author identity selects the in-memory kind**, so with no identity
 * nothing durable is written at all.
 *
 * That is FR-029a delivered by construction rather than by a check. The alternative was to
 * write the draft and then remember not to offer it back, which puts one boolean between a
 * teacher's lesson and the next person at a shared classroom computer.
 */
export type KeepResult = { ok: true } | { ok: false; reason: 'full' | 'unavailable' }

export interface DraftKeeper {
  read(key: string): string | null
  /**
   * Returns a result rather than `void`.
   *
   * `localStorage` throws `QuotaExceededError` when it is full, and a page can be denied
   * storage outright. Swallowing either would lose the work while the editor said it was being
   * kept, which is worse than not keeping at all (FR-024c).
   */
  write(key: string, value: string): KeepResult
  clear(key: string): void
}

export interface KeptWork {
  readonly lessonId: string
  readonly manifest: LessonManifest
  /** The version it was built from, so the resend carries the right one. */
  readonly token: VersionToken
}

/**
 * One lesson, one author.
 *
 * The identity is used here and nowhere else: it never enters the manifest, never reaches
 * storage, and never appears in an analytics event (FR-029b). Scoping by a key string is what
 * makes that easy to assert.
 */
export function keyFor(identity: string, lessonId: string): string {
  return `cuestack:draft:${identity}:${lessonId}`
}

/**
 * Durable across a refresh. Chosen only when the host supplies an author identity.
 *
 * The store is a parameter so the refusal paths are testable. They are not hypothetical —
 * `QuotaExceededError` is a real outcome for a whole-manifest write and a page can be denied
 * storage outright — and the only honest way to exercise them is to hand in a store that
 * refuses, since a browser's own `localStorage` cannot be persuaded to fail on request.
 */
export function browserKeeper(store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage): DraftKeeper {
  return {
    read(key) {
      try {
        return store.getItem(key)
      } catch {
        return null
      }
    },
    write(key, value) {
      try {
        store.setItem(key, value)
        return { ok: true }
      } catch (error) {
        // A full store and a page denied storage are different problems with the same shape
        // here, and the teacher needs to know either way.
        const full = error instanceof DOMException && error.name === 'QuotaExceededError'
        return { ok: false, reason: full ? 'full' : 'unavailable' }
      }
    },
    clear(key) {
      try {
        store.removeItem(key)
      } catch {
        // Nothing to do: the work is already unreachable, which is what clearing wanted.
      }
    },
  }
}

/**
 * Dies with the page, deliberately.
 *
 * Test double *and* the production choice when no identity is supplied: an interruption still
 * costs nothing within the session, and nothing survives to be offered to somebody else.
 */
export function memoryKeeper(): DraftKeeper {
  const store = new Map<string, string>()
  return {
    read: (key) => store.get(key) ?? null,
    write(key, value) {
      store.set(key, value)
      return { ok: true }
    },
    clear: (key) => void store.delete(key),
  }
}

/**
 * The keeper for this session — and the choice *is* the privacy guarantee.
 *
 * With an identity, work is durable and offered back only to whoever made it. Without one,
 * nothing durable is written, so there is nothing to leak rather than something the editor
 * declines to mention (FR-029, FR-029a).
 */
export function keeperFor(identity: string | undefined): DraftKeeper {
  return identity === undefined ? memoryKeeper() : browserKeeper()
}
