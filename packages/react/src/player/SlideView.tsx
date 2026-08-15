import type { ReactNode } from 'react'
import type { RenderState, ResolvedElement } from '@cuestack/core'
import type { ElementRendererRegistry, InteractionAccess } from '../elements/registry.js'
import type { FrameWriter } from '../frame/FrameWriter.js'
import { Placeholder } from '../elements/Placeholder.js'
import { defaultAssetResolver, type AssetResolver } from '../elements/assets.js'
import { ElementFrame } from './ElementFrame.js'

export interface SlideViewProps {
  readonly state: RenderState
  readonly renderers: ElementRendererRegistry
  /** Absent on the server, where there are no frames. */
  readonly writer?: FrameWriter
  readonly resolveAsset?: AssetResolver
  /**
   * Supplied for interactive elements only. A renderer that is not interactive receives
   * nothing, which is what makes `interaction` mean "this element takes answers" rather than
   * "interactions are available somewhere".
   */
  readonly interactionFor?: (element: ResolvedElement) => InteractionAccess | undefined
}

/**
 * One slide's elements, from a RenderState.
 *
 * Renders in the order the kernel supplied and does **not** re-sort. The kernel
 * already resolved paint order, and two consumers sorting independently is two
 * chances to sort differently — which is precisely the preview-player divergence the
 * parity principle exists to prevent.
 *
 * No timing here. Which elements exist, how opaque they are, and how far an effect has
 * moved them are all already decided.
 */
export function SlideView({
  state,
  renderers,
  writer,
  resolveAsset = defaultAssetResolver,
  interactionFor,
}: SlideViewProps): ReactNode {
  return (
    <>
      {state.elements.map((element) => {
        const renderer = renderers.get(element.type)
        return (
          <ElementFrame key={element.id} element={element} {...(writer ? { writer } : {})}>
            {renderer ? (
              <renderer.Component
                element={element}
                resolveAsset={resolveAsset}
                {...(() => {
                  const access = interactionFor?.(element)
                  return access ? { interaction: access } : {}
                })()}
              />
            ) : (
              <Placeholder element={element} />
            )}
          </ElementFrame>
        )
      })}
    </>
  )
}
