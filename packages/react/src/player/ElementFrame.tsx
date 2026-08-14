import type { ReactNode } from 'react'
import type { ResolvedElement } from '@cuestack/core'
import { elementProperties } from '../frame/applyVisual.js'
import type { FrameWriter } from '../frame/FrameWriter.js'

export interface ElementFrameProps {
  readonly element: ResolvedElement
  readonly children: ReactNode
  /** Absent on the server. When present, this node registers itself so the frame loop
   *  can address it without going through React. */
  readonly writer?: FrameWriter
}

/**
 * Applies authored geometry, so renderers never position themselves.
 *
 * A renderer that set its own geometry would become a second place position is
 * decided, and the two would eventually disagree. Keeping it here means there is one.
 *
 * Continuous values — opacity, transform, and the will-change hint derived from
 * whether an effect is active — are applied by the FrameWriter instead. They change
 * with time, and React only re-renders when visibility changes, so anything
 * timing-derived written here goes stale between renders. The rendered-parity sweep
 * caught precisely that with will-change.
 *
 * **No hooks, and no ref unless there is a writer.** This component is on the server path,
 * and a hook or a ref makes it unable to be a React Server Component — which meant the
 * static player could not render a slide with any elements on it. It built cleanly anyway,
 * because the reference lesson's first slide is empty at time zero. The stable ref callback
 * now comes from the writer, which is where registration already lived.
 */
export function ElementFrame({ element, children, writer }: ElementFrameProps): ReactNode {
  return (
    <div
      // Omitted entirely rather than passed as undefined: a Server Component may not carry
      // a ref prop at all.
      {...(writer ? { ref: writer.refFor(element.id) } : {})}
      className="cs-element"
      data-cs-element-id={element.id}
      data-cs-element-type={element.type}
      style={elementProperties(element) as React.CSSProperties}
    >
      {children}
    </div>
  )
}
