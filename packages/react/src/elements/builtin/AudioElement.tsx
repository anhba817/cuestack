import type { ReactNode } from 'react'
import type { AssetRef } from '@cuestack/schema'
import type { ElementRenderer, ElementRendererProps } from '../registry.js'
import { AssetFallback } from '../AssetFallback.js'

interface AudioPayload {
  readonly asset?: AssetRef
  readonly volume?: number
  readonly showControls?: boolean
  readonly loop?: boolean
}

/**
 * Audio, with native controls and a transcript link.
 *
 * A transcript rather than a caption track, because audio has no visual channel to overlay
 * captions onto. It is the *only* route to the content for a learner who cannot hear it, so
 * it is a visible link rather than metadata: something the learner can find without knowing
 * to look in a media menu.
 *
 * Always labelled. An `<audio>` element with no accessible name is announced as an
 * unlabelled media player, and on a slide with two of them a learner has no way to tell
 * which is which.
 */
function AudioComponent({ element, resolveAsset }: ElementRendererProps): ReactNode {
  const payload = element.payload as AudioPayload | undefined
  const asset = payload?.asset
  const src = asset ? resolveAsset(asset) : undefined

  if (!asset || src === undefined) return <AssetFallback element={element} kind="audio" />

  const transcript =
    asset.transcript === undefined ? undefined : resolveAsset({ ...asset, assetId: asset.transcript })
  const name = element.accessibility?.label ?? element.accessibility?.altText ?? 'Audio'

  return (
    <div className="cs-element-audio">
      <audio
        src={src}
        controls={payload?.showControls !== false}
        loop={payload?.loop === true}
        muted={payload?.volume === 0}
        preload="metadata"
        aria-label={name}
      />
      {transcript === undefined ? null : (
        <a className="cs-element-transcript" href={transcript}>
          Transcript
        </a>
      )}
    </div>
  )
}

export const audioRenderer: ElementRenderer = {
  type: 'audio',
  Component: AudioComponent,
  label: 'Audio',
}
