import type { Element, LessonManifest } from '@cuestack/schema'
import type { AssetAdapter } from '../adapters/index.js'

/**
 * Which assets a lesson references, and — separately — whether they exist.
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

/** Every place an asset id can hide in an element's payload. */
function idsIn(payload: unknown, into: string[]): void {
  if (payload === null || typeof payload !== 'object') return
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (key === 'assetId' && typeof value === 'string' && value !== '') into.push(value)
    else if (typeof value === 'object') idsIn(value, into)
  }
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
