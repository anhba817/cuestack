import type { ReactNode } from 'react'
import type { AssetRef } from '@cuestack/schema'
import type { ElementRenderer, ElementRendererProps } from '../registry.js'
import { AssetFallback } from '../AssetFallback.js'

interface ImagePayload {
  readonly asset?: AssetRef
  readonly caption?: string
}

/**
 * An image.
 *
 * Two obligations beyond showing it. **Alternative text** comes from the author, and
 * `alt=""` when they supplied none — a missing `alt` makes a screen reader read the file
 * name, which is never what anyone meant. An empty one says "skip this", which is what an
 * author who wrote nothing meant far more often.
 *
 * **Reserved space** comes from the asset reference's intrinsic dimensions, declared
 * before the bytes arrive. This is the reason `width` and `height` are on an asset
 * reference at all: without them the slide holds the wrong shape while loading and
 * corrects itself on load, which is the layout shift SC-004 forbids.
 */
function ImageComponent({ element, resolveAsset }: ElementRendererProps): ReactNode {
  const payload = element.payload as ImagePayload | undefined
  const asset = payload?.asset
  const src = asset ? resolveAsset(asset) : undefined

  if (!asset || src === undefined) return <AssetFallback element={element} kind="image" />

  // A caption is already read as part of the figure. When the author put the same words in
  // both, repeating them as the accessible name has a screen reader announce the sentence
  // twice — so the caption keeps them and the alt goes empty, which is the pattern WAI
  // recommends for an image its caption already describes. Exact equality, not a
  // similarity guess: the renderer is deduplicating, not deciding what is decorative.
  const authored = element.accessibility?.altText
  const alt = authored === undefined || authored === payload?.caption ? '' : authored

  const image = (
    <img
      className="cs-element-image"
      src={src}
      alt={alt}
      {...(asset.width === undefined ? {} : { width: asset.width })}
      {...(asset.height === undefined ? {} : { height: asset.height })}
      /* Not lazy: the first slide is the one being looked at, and delaying it gives back
         exactly what the server render bought. */
      decoding="async"
    />
  )

  if (payload?.caption === undefined) return image

  return (
    <figure className="cs-element-figure">
      {image}
      <figcaption className="cs-element-caption">{payload.caption}</figcaption>
    </figure>
  )
}

export const imageRenderer: ElementRenderer = {
  type: 'image',
  Component: ImageComponent,
  label: 'Image',
}
