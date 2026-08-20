import type { LessonManifest } from '@cuestack/schema'

/**
 * The interchange format, and the one thing in this framework whose shape is not the host's choice.
 *
 * Every other boundary here is an interface a host implements however it likes — storage, assets,
 * analytics, publishing. This one is fixed, because a format each host serialized its own way would
 * be portable *within* a system and nowhere else, which is the lock-in §7.7 exists to prevent
 * arriving one layer down and harder to see. Two packages exported from one lesson by different
 * callers are byte-identical (SC-002b).
 */

export const PACKAGE_FORMAT_VERSION = '1.0'

export type PackageKind = 'draft' | 'published'
export type AssetMode = 'references' | 'files'

export interface PackagedAsset {
  /** The identity **the exporting system used**. The importing one may store it under another. */
  readonly assetId: string
  /** Stored, never inferred: an asset id says nothing about what the bytes are. */
  readonly mediaType: string
  /** Files mode only. Base64 — the only way to carry bytes in JSON (research R-03). */
  readonly content?: string
}

export interface LessonPackage {
  /** This document's format. Moves independently of the lesson's (FR-003). */
  readonly packageVersion: string
  /** The lesson format the manifest was written under. */
  readonly schemaVersion: string
  /** What it was at the moment of export. A reader cannot ask the manifest (FR-004). */
  readonly kind: PackageKind
  readonly assetMode: AssetMode
  readonly lesson: LessonManifest
  readonly assets: readonly PackagedAsset[]
}

const KINDS: ReadonlySet<string> = new Set<PackageKind>(['draft', 'published'])
const MODES: ReadonlySet<string> = new Set<AssetMode>(['references', 'files'])

function isAsset(value: unknown, mode: AssetMode): value is PackagedAsset {
  if (value === null || typeof value !== 'object') return false
  const asset = value as Record<string, unknown>
  if (typeof asset['assetId'] !== 'string' || asset['assetId'] === '') return false
  if (typeof asset['mediaType'] !== 'string' || asset['mediaType'] === '') return false
  /**
   * The one check about agreement between two fields rather than about a field.
   *
   * `assetMode` is the claim a reader trusts before it looks at anything else. A document saying
   * `files` while carrying references would have a reader treat an incomplete package as complete,
   * which is the failure the mode distinction exists to prevent.
   */
  if (mode === 'files' && typeof asset['content'] !== 'string') return false
  return true
}

/**
 * Structural only. Whether the *lesson* is a lesson is `validate`'s question, and whether its
 * version can be read is `migrate`'s — this says whether the envelope is an envelope.
 */
export function isLessonPackage(value: unknown): value is LessonPackage {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const pkg = value as Record<string, unknown>

  if (typeof pkg['packageVersion'] !== 'string' || pkg['packageVersion'] === '') return false
  if (typeof pkg['schemaVersion'] !== 'string' || pkg['schemaVersion'] === '') return false
  if (typeof pkg['kind'] !== 'string' || !KINDS.has(pkg['kind'])) return false
  if (typeof pkg['assetMode'] !== 'string' || !MODES.has(pkg['assetMode'])) return false
  if (pkg['lesson'] === null || typeof pkg['lesson'] !== 'object') return false
  if (!Array.isArray(pkg['assets'])) return false

  const mode = pkg['assetMode'] as AssetMode
  return (pkg['assets'] as unknown[]).every((asset) => isAsset(asset, mode))
}

/**
 * Ordering for **this document's** version, and nothing else.
 *
 * The lesson format version is `migrate`'s entirely: `resolveChain` already refuses an unknown one
 * and already distinguishes newer from older, with a message worth quoting rather than restating. A
 * second lesson-version comparison here would be a second place to disagree about the same fact
 * (research R-05).
 *
 * Numeric per segment rather than lexical, because `'1.10' < '1.9'` as text and that day arrives
 * eventually rather than never.
 */
export function comparePackageVersions(a: string, b: string): number {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const x = left[i] ?? 0
    const y = right[i] ?? 0
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}
