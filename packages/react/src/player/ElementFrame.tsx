import type { ReactNode } from 'react'
import type { ResolvedElement } from '@cuestack/core'
import { elementProperties } from '../frame/applyVisual.js'

export interface ElementFrameProps {
  readonly element: ResolvedElement
  readonly children: ReactNode
}

/**
 * Applies every visual property, so renderers never position themselves.
 *
 * A renderer that set its own geometry would become a second place position is
 * decided, and the two would eventually disagree. Keeping it here means there is one.
 *
 * `will-change` comes from the kernel's `activeEffects` rather than from any state
 * held here. Tracking "is this animating" locally would be a second, private model of
 * timing — the divergence Principle V forbids, arriving through an optimisation
 * rather than a feature (research R-06).
 */
export function ElementFrame({ element, children }: ElementFrameProps): ReactNode {
  const animating = element.activeEffects.length > 0
  return (
    <div
      className="cs-element"
      data-cs-element-id={element.id}
      data-cs-element-type={element.type}
      style={{
        ...(elementProperties(element) as React.CSSProperties),
        ...(animating ? { willChange: 'transform, opacity' } : {}),
      }}
    >
      {children}
    </div>
  )
}
