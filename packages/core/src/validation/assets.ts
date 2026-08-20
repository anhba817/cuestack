import type { Element, LessonManifest } from '@cuestack/schema'
import type { AssetAdapter } from '../adapters/index.js'

/**
 * Asset references: found, checked, and rewritten.
 *
 * The file was "which assets a lesson references" until feature 010 needed to *change* them on
 * import. Rewriting is not validation and the name says validation — but the finder and the
 * rewriter must agree about what an asset reference is, and two walks in two files drift the first
 * time an element type carries an asset somewhere new. That is the same argument that made the
 * finder shared in the first place, so they live together and the header carries the explanation
 * (research R-04).
 *
 * The split is the point. *Which* is a fact about the manifest: pure, synchronous, deterministic.
 * *Whether* is a question for the outside world, and only the second needs to wait — so the engine
 * stays pure and the availability check is a pass a caller may skip entirely and still get every
 * other issue (FR-016a).
 *
 * **Both the warning pass and the publish check use `collectAssetRefs`.** One rule reported at two
 * strengths is a courtesy; two rules disagreeing about which assets a lesson uses is a defect, and a
 * separate walk in the publish path is exactly how a report comes to say a lesson is fine while
 * publishing refuses it for an asset the report never looked at (FR-016b).
 */

export interface AssetRef {
  readonly assetId: string
  readonly slideId: string
  readonly elementId: string
}

/**
 * The one rule, extracted so the finder and the rewriter cannot hold different opinions of it.
 *
 * Co-location would not have been enough: `idsIn` collects into an array and a rewriter has to build
 * a new object, so there is no walk to share — only this predicate and the descent rule beside it.
 */
const isAssetId = (key: string, value: unknown): value is string =>
  key === 'assetId' && typeof value === 'string' && value !== ''

/** Every place an asset id can hide in an element's payload. */
function idsIn(payload: unknown, into: string[]): void {
  if (payload === null || typeof payload !== 'object') return
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (isAssetId(key, value)) into.push(value)
    // Note the `else`: a value *under* an `assetId` key is not descended into. The rewriter below
    // reproduces that exactly, because the two disagreeing is the defect this pairing prevents.
    else if (typeof value === 'object') idsIn(value, into)
  }
}

/**
 * The same walk, producing a new value instead of a list.
 *
 * Used by import: the host stores the assets its own way and says which new identity replaced which
 * old one, and this rewrites the lesson's references to match. A lesson pointing at the exporting
 * system's ids is a lesson whose every image is blank while its manifest stays perfectly valid — a
 * failure nothing would report (FR-014b).
 *
 * Pure: the input is never touched, and an identity the mapping does not cover is left exactly as it
 * was so the caller can report it (FR-014c, FR-014d).
 */
function remapIn(value: unknown, mapping: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => remapIn(item, mapping))
  if (value === null || typeof value !== 'object') return value

  const out: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (isAssetId(key, nested)) out[key] = mapping.get(nested) ?? nested
    else if (typeof nested === 'object') out[key] = remapIn(nested, mapping)
    else out[key] = nested
  }
  return out
}

export function remapAssetIds(
  manifest: LessonManifest,
  mapping: ReadonlyMap<string, string>,
): LessonManifest {
  return remapIn(manifest, mapping) as LessonManifest
}

/**
 * Pure. Walks the payload rather than naming the fields, because `assetId` appears at three depths
 * already — `payload.asset.assetId`, `payload.asset.captionTrack`, `payload.poster` — and a list of
 * paths would go stale the first time a type added a fourth.
 */
export function collectAssetRefs(manifest: LessonManifest): readonly AssetRef[] {
  const refs: AssetRef[] = []
  for (const slide of manifest.slides) {
    for (const element of slide.elements as readonly Element[]) {
      const ids: string[] = []
      idsIn(element.payload, ids)
      for (const assetId of ids) refs.push({ assetId, slideId: slide.id, elementId: element.id })
    }
  }
  return refs
}

export interface UnresolvedAsset extends AssetRef {
  readonly message: string
}

/**
 * Async, and optional. Resolves each distinct id once.
 *
 * The result is a *warning* when validation asks and an *error* when publishing asks, and the two
 * are separate calls rather than one cached answer — the answer's ability to change between the two
 * moments is the entire reason there are two, and BR-018 is about what the published package
 * references.
 */
export async function checkAssets(
  refs: readonly AssetRef[],
  assets: AssetAdapter,
): Promise<readonly UnresolvedAsset[]> {
  const distinct = [...new Set(refs.map((r) => r.assetId))]
  const resolved = new Map<string, boolean>()
  await Promise.all(
    distinct.map(async (assetId) => {
      try {
        resolved.set(assetId, (await assets.resolve(assetId)) !== null)
      } catch {
        // An adapter that throws is an adapter that cannot answer, which for this purpose is the
        // same as answering no — and a report is not the place to surface a host's exception.
        resolved.set(assetId, false)
      }
    }),
  )

  return refs
    .filter((ref) => resolved.get(ref.assetId) === false)
    .map((ref) => ({
      ...ref,
      message:
        `The asset "${ref.assetId}" used by "${ref.elementId}" could not be found. Re-upload it or ` +
        'point the element at one that exists — a learner would see a labelled gap where it should be.',
    }))
}
