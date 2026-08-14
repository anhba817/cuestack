import type { ReactNode } from 'react'
import type { AssetRef } from '@cuestack/schema'
import type { ElementRenderer, ElementRendererProps } from '../registry.js'
import { AssetFallback } from '../AssetFallback.js'

interface VideoPayload {
  readonly asset?: AssetRef
  readonly volume?: number
  readonly showControls?: boolean
  readonly loop?: boolean
  readonly poster?: string
}

/**
 * Video, with native controls and its caption track.
 *
 * Native controls deliberately: a browser's own media controls are keyboard-operable,
 * screen-reader-labelled, and localised, and a hand-built replacement would have to earn
 * all three back. Wave 3 drives playback from lesson time and will need its own controls;
 * until then reimplementing them would be work thrown away and accessibility risk taken on.
 *
 * The caption track is `default`. A track that is present but not default is captions the
 * learner has to go looking for, which for a compliance lesson is the same as not having
 * them.
 *
 * No `autoplay`, ever, from this renderer. BR-014 requires a gesture for audible playback
 * and Wave 3 enforces it; emitting it now would put a rule violation in server-rendered
 * markup that the client is not yet in a position to check.
 */
function VideoComponent({ element, resolveAsset }: ElementRendererProps): ReactNode {
  const payload = element.payload as VideoPayload | undefined
  const asset = payload?.asset
  const src = asset ? resolveAsset(asset) : undefined

  if (!asset || src === undefined) return <AssetFallback element={element} kind="video" />

  const captions = asset.captionTrack === undefined ? undefined : resolveAsset({ ...asset, assetId: asset.captionTrack })
  // Always named. A `<video controls>` with no accessible name is announced as an
  // unlabelled media player, and on a slide with two of them a learner cannot tell which
  // is which. The generic fallback is worse than an authored name and far better than none.
  const name = element.accessibility?.label ?? element.accessibility?.altText ?? 'Video'

  return (
    <video
      className="cs-element-video"
      src={src}
      controls={payload?.showControls !== false}
      loop={payload?.loop === true}
      // A volume of zero is an authored intent to be silent, and `muted` is the only way
      // to express it in markup the server can emit.
      muted={payload?.volume === 0}
      playsInline
      preload="metadata"
      {...(asset.width === undefined ? {} : { width: asset.width })}
      {...(asset.height === undefined ? {} : { height: asset.height })}
      {...(payload?.poster === undefined ? {} : { poster: resolveAsset({ ...asset, assetId: payload.poster }) })}
      aria-label={name}
    >
      {/* Omitted entirely when unauthored: an empty track makes a browser offer a captions
          control that does nothing, which is worse than offering none. */}
      {captions === undefined ? null : (
        <track kind="captions" src={captions} default label="Captions" />
      )}
    </video>
  )
}

export const videoRenderer: ElementRenderer = {
  type: 'video',
  Component: VideoComponent,
  label: 'Video',
}
