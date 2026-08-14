import type { AssetRef } from '@cuestack/schema'

/**
 * Turning an asset reference into something a browser can fetch.
 *
 * **Not in the spec, and unavoidable.** An `<img>` needs a `src`, and the manifest
 * carries `assetId` — which the reference fixture shows is an opaque key
 * (`asset_worker_image`), not a locator. Nothing in feature 003's requirements says how
 * one becomes the other. BR-018, "published playback shall reference the exact assets
 * included in or authorized for the published version", is the rule that governs it, and
 * it belongs to Wave 5 along with publishing. So this wave needs a seam, not an answer.
 *
 * The seam is a function a host supplies. The default applies one rule rather than a
 * guess: an assetId that is *already* a locator is used as one; anything else is
 * unresolvable, because the framework cannot invent a host's URL scheme.
 *
 * An unresolvable asset renders `AssetFallback` — reserved space and a description
 * (FR-018). That is deliberately the same path a genuine load failure takes. The
 * alternative, emitting `src="asset_worker_image"`, would produce a broken relative
 * request and a broken-image icon in server-rendered markup, and would need a *second*
 * degradation mode to recover from. One visible failure beats two.
 *
 * This does not weaken FR-023 ("render a lesson by supplying it to the player, with no
 * further configuration"): a lesson renders with no configuration. Its assets are
 * addressable only once a host says where they live, which is a fact about assets rather
 * than a configuration burden.
 */
export type AssetResolver = (ref: AssetRef) => string | undefined

/** Schemes and path forms that are already addressable without a host's help. */
const LOCATOR = /^(?:https?:\/\/|\/\/|\/|\.\.?\/|data:|blob:)/

export const defaultAssetResolver: AssetResolver = (ref) =>
  LOCATOR.test(ref.assetId) ? ref.assetId : undefined
