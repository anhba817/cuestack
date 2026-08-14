'use client'

import { LessonPlayer, PlaybackControls, type AssetResolver } from '@cuestack/react'
import type { LessonManifest } from '@cuestack/schema'

/**
 * The player, on the client side of the RSC boundary.
 *
 * A client component, and server-rendered all the same — that is ordinary SSR, and it is
 * what produces the first frame in the HTML document. Hydration then starts playback. The
 * two halves must agree, which they do by construction: the client's first render is the
 * same pure `resolve(slide, 0)` the server made (research R-03).
 *
 * `'use client'` here rather than in the package. A library that marks itself client-only
 * cannot be server-rendered by anyone, which would give up the whole point; the boundary
 * belongs to the host, and this file is the host drawing it.
 *
 * The controls go *inside* the player, because they need the transport and the transport must
 * stay singular — a host holding its own would be a second idea of the current time. They
 * render nothing until the transport exists, which is what keeps the hydration pass matching
 * the server.
 *
 * The reference lesson's assets are opaque ids with nothing serving them, so the resolver
 * returns undefined and every media element renders its reserved-space fallback. That is
 * the honest demonstration: this repository hosts no assets, and pretending otherwise would
 * mean shipping broken `src` attributes.
 */
const noAssetsHere: AssetResolver = () => undefined

export function LessonView({ lesson }: { lesson: LessonManifest }) {
  return (
    <LessonPlayer lesson={lesson} autoPlay resolveAsset={noAssetsHere}>
      <PlaybackControls />
    </LessonPlayer>
  )
}
