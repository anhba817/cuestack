import type { DraftKeeper, KeepResult } from '../../src/persistence/keeper.js'

/**
 * Keeper doubles, and one assertion that is really a privacy check.
 *
 * `nothingDurableWritten` is the interesting one. FR-029a says that with no author identity
 * nothing is offered on reopening, and the implementation delivers that by choosing an
 * in-memory keeper rather than by remembering not to offer — so the way to test it is to
 * assert that `localStorage` was never touched at all. A test that only checked "no offer
 * appeared" would pass against an implementation that wrote the draft to a shared classroom
 * machine and then declined to mention it.
 */
export interface SpyKeeper extends DraftKeeper {
  readonly writes: { key: string; value: string }[]
  readonly clears: string[]
  /** Make the next write fail, the way a full `localStorage` does. */
  refuse(reason?: 'full' | 'unavailable'): void
}

export function spyKeeper(): SpyKeeper {
  const store = new Map<string, string>()
  const writes: { key: string; value: string }[] = []
  const clears: string[] = []
  let refusal: 'full' | 'unavailable' | null = null

  return {
    writes,
    clears,
    refuse(reason = 'full') {
      refusal = reason
    },
    read: (key) => store.get(key) ?? null,
    write(key, value): KeepResult {
      if (refusal) {
        const reason = refusal
        refusal = null
        return { ok: false, reason }
      }
      writes.push({ key, value })
      store.set(key, value)
      return { ok: true }
    },
    clear(key) {
      clears.push(key)
      store.delete(key)
    },
  }
}

/** Assert the browser's own storage was never touched. */
export function nothingDurableWritten(): void {
  if (typeof localStorage === 'undefined') return
  const keys = Object.keys(localStorage).filter((k) => k.startsWith('cuestack:'))
  if (keys.length > 0) {
    throw new Error(
      `Expected nothing durable to be written, but localStorage holds: ${keys.join(', ')}. ` +
        'With no author identity the keeper must be the in-memory one (FR-029a).',
    )
  }
}
