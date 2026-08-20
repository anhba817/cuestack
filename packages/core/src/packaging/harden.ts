/**
 * What import does about a package that is hostile rather than merely damaged.
 *
 * A package is a file somebody was emailed. Three checks, and a boundary stated rather than implied:
 * asset content is **not** inspected and markup is **not** rewritten, because this framework renders
 * nothing itself and would be sanitizing against a renderer it has to guess at — a check that
 * guesses wrong reads as protection while providing none (FR-016c).
 */

export interface HardeningBounds {
  /** Refused before parsing. A parser that finds the problem has already done the expensive thing. */
  readonly maxBytes: number
  readonly maxDepth: number
}

export const HARDENING_DEFAULTS: HardeningBounds = {
  maxBytes: 64 * 1024 * 1024,
  maxDepth: 64,
}

/**
 * Schemes a click can follow without running anything.
 *
 * `javascript:` in a button's address is a script the host runs on behalf of whoever sent the
 * package. `data:` can carry a document with one inside it. Everything not on this list is refused
 * rather than allowed, because a deny-list is a list of the attacks somebody thought of.
 */
const SAFE_SCHEMES: ReadonlySet<string> = new Set(['https:', 'http:', 'mailto:'])

/** Keys whose string values a learner's click can follow. */
const ADDRESS_KEYS: ReadonlySet<string> = new Set(['url', 'href'])

export function depthOf(value: unknown, limit: number, at = 0): number {
  if (at > limit || value === null || typeof value !== 'object') return at
  let deepest = at
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepest = Math.max(deepest, depthOf(nested, limit, at + 1))
    if (deepest > limit) return deepest
  }
  return deepest
}

export interface UnsafeAddress {
  readonly key: string
  readonly value: string
}

/**
 * Every address-bearing field, found **by key at any depth** — never by element type.
 *
 * The only address in the format today is a button's `url`, and the shortest correct-looking check
 * is `if (element.type === 'button')`. That is a switch on element type inside core, which
 * Constitution I calls a defect outright; the ESLint rule that would catch it matches
 * `SwitchStatement` only, so the `if` form passes lint cleanly and this comment is part of the
 * protection. It would also miss a third-party plugin carrying an address, which is the case a
 * type-based check gets wrong in production rather than in review.
 *
 * The same shape as `collectAssetRefs`'s walk, for the same reason: a list of paths goes stale the
 * first time a type puts an address somewhere new.
 */
export function findUnsafeAddresses(value: unknown, found: UnsafeAddress[] = []): UnsafeAddress[] {
  if (value === null || typeof value !== 'object') return found
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (ADDRESS_KEYS.has(key) && typeof nested === 'string') {
      if (!isSafeAddress(nested)) found.push({ key, value: nested })
    } else if (typeof nested === 'object') {
      findUnsafeAddresses(nested, found)
    }
  }
  return found
}

/**
 * Case- and whitespace-insensitive, because an attacker reads the check too.
 *
 * A relative address carries no scheme and cannot execute, so it passes: refusing one would reject
 * ordinary lessons to no benefit.
 */
function isSafeAddress(address: string): boolean {
  const trimmed = address.trim()
  const colon = trimmed.indexOf(':')
  if (colon < 0) return true
  const scheme = trimmed.slice(0, colon + 1).toLowerCase()
  // A colon inside a path rather than a scheme — "a/b:c" — is not a scheme at all.
  if (/[/?#]/.test(trimmed.slice(0, colon))) return true
  return SAFE_SCHEMES.has(scheme)
}
