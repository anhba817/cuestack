import type { ReactNode } from 'react'
import type { RenderState } from '@cuestack/core'
import type { ElementRendererRegistry } from '../elements/registry.js'
import type { FrameWriter } from '../frame/FrameWriter.js'
import { Placeholder } from '../elements/Placeholder.js'
import { ElementFrame } from './ElementFrame.js'

export interface SlideViewProps {
  readonly state: RenderState
  readonly renderers: ElementRendererRegistry
  /** Absent on the server, where there are no frames. */
  readonly writer?: FrameWriter
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
export function SlideView({ state, renderers, writer }: SlideViewProps): ReactNode {
  return (
    <>
      {state.elements.map((element) => {
        const renderer = renderers.get(element.type)
        return (
          <ElementFrame key={element.id} element={element} {...(writer ? { writer } : {})}>
            {renderer ? (
              <renderer.Component element={element} />
            ) : (
              <Placeholder element={element} />
            )}
          </ElementFrame>
        )
      })}
    </>
  )
}
