import type { ReactNode } from 'react'
import type { RenderState, ResolvedElement } from '@cuestack/core'
import type { ElementRendererRegistry, InteractionAccess, NavigationAccess } from '../elements/registry.js'
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
  /** The same shape one type over: built per element, `undefined` for anything but a button. */
  readonly navigationFor?: (element: ResolvedElement) => NavigationAccess | undefined
  /**
   * Changes when the learner retries a failed asset.
   *
   * Used as part of each element's React key, so retrying remounts the elements and their
   * `<img>` and `<video>` nodes request their sources again. A browser will not re-fetch a
   * `src` it already failed on unless the element is new — so the alternative is a cache-
   * busting query parameter, which changes the URL a host gave us and would defeat their
   * caching for every subsequent load.
   */
  readonly retryToken?: number
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
  navigationFor,
  retryToken = 0,
}: SlideViewProps): ReactNode {
  return (
    <>
      {state.elements.map((element) => {
        const renderer = renderers.get(element.type)
        return (
          <ElementFrame
            key={`${element.id}#${retryToken}`}
            element={element}
            {...(writer ? { writer } : {})}
          >
            {renderer ? (
              <renderer.Component
                element={element}
                resolveAsset={resolveAsset}
                {...(() => {
                  const access = interactionFor?.(element)
                  const nav = navigationFor?.(element)
                  return { ...(access ? { interaction: access } : {}), ...(nav ? { navigation: nav } : {}) }
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
