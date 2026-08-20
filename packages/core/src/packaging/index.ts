import type { LessonManifest } from '@cuestack/schema'
import { migrate } from '@cuestack/schema/migrate'
import type { ValidationIssue } from '@cuestack/schema/validate'
import { collectAssetRefs, remapAssetIds } from '../validation/assets.js'
import { checkLesson, type ReportIssue } from '../validation/index.js'
import type { ElementRegistry } from '../elements/registry.js'
import { fromBase64 } from './base64.js'
import {
  HARDENING_DEFAULTS,
  depthOf,
  findUnsafeAddresses,
  type HardeningBounds,
} from './harden.js'
import { toBase64 } from './base64.js'
import type { AssetMode, LessonPackage, PackageKind, PackagedAsset } from './format.js'

import { comparePackageVersions, isLessonPackage as isLessonPackageGuard, PACKAGE_FORMAT_VERSION } from './format.js'

export {
  PACKAGE_FORMAT_VERSION,
  comparePackageVersions,
  isLessonPackage,
  type AssetMode,
  type LessonPackage,
  type PackageKind,
  type PackagedAsset,
} from './format.js'
export { toBase64, fromBase64 } from './base64.js'
export { HARDENING_DEFAULTS, type HardeningBounds } from './harden.js'
export { collectAssetRefs, remapAssetIds } from '../validation/assets.js'

/**
 * Taking a lesson out of this framework, in a form anybody can read.
 *
 * §7.7's anti-lock-in promise, and the half that works alone: a package that can be read by hand is
 * worth having with no importer anywhere, because the value of a copy is that somebody else can read
 * it.
 *
 * **Two modes, and the default is the harmless one.** Reference mode names the assets and is pure —
 * no network, no waiting — because a teacher asking for a copy of their work should not trigger a
 * media transfer they did not ask for. Files mode carries the bytes and is the deliberate choice,
 * made by somebody who knows why they want it.
 *
 * **The framework never fetches.** `AssetAdapter.resolve` returns an address, not bytes, and turning
 * one into the other needs the network and credentials the framework is forbidden to hold. The host
 * is also the only participant that *can* do it correctly — its assets may be behind a signed URL,
 * on a filesystem its server can read, or already in memory (research R-02).
 */

export interface ExportOptions {
  /**
   * Draft or published. Taken from the caller because the framework cannot tell: the two are the
   * same shape, and a package claiming to be a published lesson when it was a draft is a lie a
   * teacher has no way to detect (FR-004, FR-004d).
   */
  readonly kind: PackageKind
}

/** Bytes in, never text the caller encoded — encoding is the format's business (FR-006e). */
export type AssetContentProvider = (assetId: string) => Promise<Uint8Array | null>

export interface FilesExportOptions extends ExportOptions {
  readonly content: AssetContentProvider
}

/**
 * The inventory: each distinct asset once, in the order the manifest mentions it first.
 *
 * Reuses `collectAssetRefs` — feature 009's walk, which finds an `assetId` at any depth rather than
 * naming the paths it expects. A second walk here would go stale the first time an element type
 * carried an asset somewhere new, and would disagree with the one validation already uses.
 */
function inventory(manifest: LessonManifest): { assetId: string; mediaType: string }[] {
  const seen = new Map<string, string>()
  for (const ref of collectAssetRefs(manifest)) {
    if (!seen.has(ref.assetId)) seen.set(ref.assetId, mediaTypeFor(manifest, ref.assetId))
  }
  return [...seen].map(([assetId, mediaType]) => ({ assetId, mediaType }))
}

/**
 * The media type sitting beside the id, wherever it sits.
 *
 * The format's asset reference is `{ assetId, mimeType, ... }`, so the type is already in the
 * manifest — this finds the object carrying the id rather than guessing from an extension, because
 * an asset id has no extension to guess from.
 */
function mediaTypeFor(manifest: LessonManifest, assetId: string): string {
  let found = 'application/octet-stream'
  const walk = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return
    const record = value as Record<string, unknown>
    if (record['assetId'] === assetId && typeof record['mimeType'] === 'string') {
      found = record['mimeType']
      return
    }
    for (const nested of Object.values(record)) walk(nested)
  }
  walk(manifest)
  return found
}

function envelope(
  manifest: LessonManifest,
  kind: PackageKind,
  assetMode: AssetMode,
  assets: readonly PackagedAsset[],
): LessonPackage {
  // Key order is fixed here rather than left to construction order, because two exports of one
  // lesson must be byte-identical whoever asked for them (SC-002b).
  return {
    packageVersion: PACKAGE_FORMAT_VERSION,
    schemaVersion: manifest.schemaVersion,
    kind,
    assetMode,
    lesson: manifest,
    assets,
  }
}

/**
 * Reference mode. Pure, synchronous, and complete.
 *
 * The signature is the guarantee: there is no provider parameter to supply and no promise to await,
 * so an implementation that reached for the outside world could not do so quietly (SC-002a).
 */
export function exportLesson(manifest: LessonManifest, options: ExportOptions): LessonPackage {
  return envelope(manifest, options.kind, 'references', inventory(manifest))
}

/**
 * Files mode. Asynchronous, and it fails loudly.
 *
 * An asset whose content the provider cannot supply ends the export naming that asset (FR-006c). A
 * package silently missing one image while claiming to be self-contained is worse than no package —
 * the teacher would find out from a learner.
 */
export async function exportLessonWithFiles(
  manifest: LessonManifest,
  options: FilesExportOptions,
): Promise<LessonPackage> {
  const wanted = inventory(manifest)
  const assets: PackagedAsset[] = []

  for (const { assetId, mediaType } of wanted) {
    const bytes = await options.content(assetId)
    if (bytes === null) {
      throw new Error(
        `Cannot export "${assetId}" with its files: its content could not be obtained. The package ` +
          'would claim to be self-contained and would be missing this asset. Supply the content, or ' +
          'export in reference mode, which names assets rather than carrying them.',
      )
    }
    assets.push({ assetId, mediaType, content: toBase64(bytes) })
  }

  return envelope(manifest, options.kind, 'files', assets)
}

/* ---------------------------------------------------------------------------------------------
 * Reading a package, and producing its lesson — two steps, deliberately.
 * ------------------------------------------------------------------------------------------- */

/** Asset content as bytes, decoded. The host stores bytes, not text it would have to decode. */
export interface ImportedAsset {
  readonly assetId: string
  readonly mediaType: string
  readonly content?: Uint8Array
}

export interface ImportedPackage {
  readonly packageVersion: string
  readonly schemaVersion: string
  readonly kind: PackageKind
  readonly assetMode: AssetMode
  readonly assets: readonly ImportedAsset[]
  /**
   * The package wrapper, still unvalidated as a lesson — that is `importLesson`'s step.
   *
   * Named `envelope` rather than `document`: this kernel is headless, and `headless.test.ts`
   * checks the source text for DOM globals, so a field named after one reads as a browser
   * dependency whether or not it is one.
   */
  readonly envelope: LessonPackage
}

export type RefusalReason =
  | 'too-large'
  | 'too-deep'
  | 'unreadable'
  | 'package-version-unsupported'
  | 'lesson-version-unsupported'
  | 'unsafe-address'

export interface PackageRefusal {
  readonly ok: false
  readonly reason: RefusalReason
  readonly message: string
  /** Present for `lesson-version-unsupported`: `migrate`'s own issues, not a restatement. */
  readonly issues: readonly ValidationIssue[]
}

export type ReadResult = { readonly ok: true; readonly package: ImportedPackage } | PackageRefusal

export interface ReadOptions extends Partial<HardeningBounds> {
  /** Injectable so "refused before parsing" can be asserted rather than assumed. */
  readonly parse?: (text: string) => unknown
}

const refuse = (
  reason: RefusalReason,
  message: string,
  issues: readonly ValidationIssue[] = [],
): PackageRefusal => ({ ok: false, reason, message, issues })

/**
 * Read a package, without producing its lesson.
 *
 * Separable because a host must be able to learn what a package contains — and to store or refuse
 * its assets — **before** it has a lesson to save. That ordering is what makes "a lesson referencing
 * an asset that was never stored" unreachable by ordinary use rather than merely discouraged
 * (FR-014a).
 *
 * The order of the checks is the contract: size before parsing, then depth, then the package's own
 * version, then addresses. The lesson's version is not checked here at all — that is `migrate`'s,
 * entirely, and it happens in `importLesson`.
 */
export function readPackage(text: string, options: ReadOptions = {}): ReadResult {
  const maxBytes = options.maxBytes ?? HARDENING_DEFAULTS.maxBytes
  const maxDepth = options.maxDepth ?? HARDENING_DEFAULTS.maxDepth
  const parse = options.parse ?? (JSON.parse as (t: string) => unknown)

  if (text.length > maxBytes) {
    return refuse(
      'too-large',
      `This package is larger than the ${maxBytes} bytes this reader accepts, so it was not opened. ` +
        'Nothing was read from it. If the lesson genuinely is this large, raise the limit deliberately.',
    )
  }

  let envelope: unknown
  try {
    envelope = parse(text)
  } catch {
    /**
     * Deep nesting arrives here too: `JSON.parse` throws `RangeError` rather than hanging, so the
     * engine bounds the attack and this turns that into a named refusal. Checking depth *before*
     * parsing would need a streaming parser — a large amount of security-critical code to avoid one
     * `JSON.parse` (research R-06).
     */
    return refuse(
      'unreadable',
      'This file could not be read as a lesson package. It may be damaged, incomplete, or not a ' +
        'lesson package at all. Nothing was imported — check you have the whole file.',
    )
  }

  if (depthOf(envelope, maxDepth) > maxDepth) {
    return refuse(
      'too-deep',
      `This package nests more than ${maxDepth} levels deep, which no lesson does, so it was not ` +
        'read. Nothing was imported.',
    )
  }

  if (!isLessonPackageValue(envelope)) {
    return refuse(
      'unreadable',
      'This file is not shaped like a lesson package: the information a reader needs before it can ' +
        'open one is missing or malformed. Nothing was imported — check you have the right file.',
    )
  }

  if (comparePackageVersions(envelope.packageVersion, PACKAGE_FORMAT_VERSION) !== 0) {
    const newer = comparePackageVersions(envelope.packageVersion, PACKAGE_FORMAT_VERSION) > 0
    return refuse(
      'package-version-unsupported',
      newer
        ? `This package is written in format ${envelope.packageVersion}, newer than the ` +
            `${PACKAGE_FORMAT_VERSION} this reader understands. Reading it needs a newer version of ` +
            'this software; nothing was imported rather than part of it.'
        : `This package is written in format ${envelope.packageVersion}, which this reader no longer ` +
            `understands — it reads ${PACKAGE_FORMAT_VERSION}. Nothing was imported.`,
    )
  }

  const unsafe = findUnsafeAddresses(envelope.lesson)
  if (unsafe.length > 0) {
    const first = unsafe[0]!
    const scheme = first.value.trim().split(':')[0]
    return refuse(
      'unsafe-address',
      `This package contains a "${first.key}" address using the "${scheme}" scheme, which runs code ` +
        'rather than opening a page. A learner clicking it would run it inside this application, so ' +
        'the package was refused. Nothing was imported.',
    )
  }

  return {
    ok: true,
    package: {
      packageVersion: envelope.packageVersion,
      schemaVersion: envelope.schemaVersion,
      kind: envelope.kind,
      assetMode: envelope.assetMode,
      // Decoded here so a host stores bytes rather than text it would have to decode itself
      // — encoding is the format's business at both boundaries (FR-006e).
      assets: envelope.assets.map((asset) => ({
        assetId: asset.assetId,
        mediaType: asset.mediaType,
        ...(asset.content === undefined ? {} : { content: fromBase64(asset.content) }),
      })),
      envelope,
    },
  }
}

export interface ImportOptions {
  /**
   * The identity the resulting lesson carries. Never the package's: that id belongs to whatever
   * system produced it, and honouring it would let a package sent by a stranger land on top of an
   * unrelated lesson that happens to share it (FR-015a).
   */
  readonly lessonId: string
  /** Where the host stored each asset, if anywhere. Omitted entries are reported, not dropped. */
  readonly assets?: ReadonlyMap<string, string>
  /**
   * The host's element registry, used when reporting issues.
   *
   * A supplied registry **replaces** the default rather than extending it, so a host with custom
   * types that omitted this would see every custom element reported as unknown — a lesson called
   * broken because the reader had been told about seven types (FR-017a).
   */
  readonly elements?: ElementRegistry
}

export interface ImportResult {
  readonly ok: true
  readonly lesson: LessonManifest
  /** The migration steps applied. Empty when none were (FR-011). */
  readonly migrated: readonly string[]
  /** Referenced, and not in the mapping. Kept in the lesson, reported here (FR-014c). */
  readonly unresolvedAssets: readonly string[]
  /** From `checkLesson`. Never a reason to refuse (FR-017). */
  readonly issues: readonly ReportIssue[]
}

/**
 * Produce the lesson, once the assets have landed.
 *
 * **Nothing is stored.** The caller saves the result through the path it already uses, so there is
 * exactly one route by which a lesson reaches storage and exactly one place conflict, offline, and
 * acknowledgement are handled. FR-016's "a failed import leaves nothing behind" follows from that
 * rather than being arranged: there is nothing a failure could strand.
 *
 * **The lesson's version is `migrate`'s question entirely.** It carries forward, refuses a version
 * newer than this reader supports, and — the part worth not duplicating — ends with an unconditional
 * `validate`, whose own comment says "the result must be a valid current-version manifest, not merely
 * a transformed one". A second `validate` call here would be redundant work and a second place to
 * disagree about what valid means (research R-05, FR-013).
 */
export function importLesson(
  read: ImportedPackage,
  options: ImportOptions,
): ImportResult | PackageRefusal {
  const migrated = migrate(read.envelope.lesson)
  if (!migrated.ok) {
    return refuse(
      'lesson-version-unsupported',
      `This package holds a lesson in format ${read.schemaVersion}, which could not be brought ` +
        'forward. Nothing was imported. The details below say why.',
      migrated.issues,
    )
  }

  const mapping = options.assets ?? new Map<string, string>()
  const carried = migrated.manifest as unknown as LessonManifest
  const remapped = mapping.size > 0 ? remapAssetIds(carried, mapping) : carried

  const lesson = {
    ...remapped,
    lesson: { ...remapped.lesson, id: options.lessonId },
  } as LessonManifest

  const unresolved = [
    ...new Set(
      collectAssetRefs(lesson)
        .map((ref) => ref.assetId)
        .filter((assetId) => ![...mapping.values()].includes(assetId)),
    ),
  ]

  return {
    ok: true,
    lesson,
    migrated: migrated.applied,
    unresolvedAssets: unresolved,
    issues: checkLesson(lesson, options.elements ? { elements: options.elements } : {}).issues,
  }
}

/** Narrowing helper, so `readPackage` reads as the ordered list of checks it is. */
function isLessonPackageValue(value: unknown): value is LessonPackage {
  return isLessonPackageGuard(value)
}
