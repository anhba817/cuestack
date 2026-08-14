import type { ReactNode } from 'react'
import type { ResolvedElement } from '@cuestack/core'

/**
 * An element whose type this host has not registered.
 *
 * Reserves the space and says so. The alternative — rendering nothing — would make a
 * missing renderer indistinguishable from an authoring mistake, and would reflow the
 * slide around the gap.
 */
export function Placeholder({ element }: { element: ResolvedElement }): ReactNode {
  return (
    <div className="cs-placeholder" role="note">
      Content unavailable: this player does not support “{element.type}” elements.
    </div>
  )
}
