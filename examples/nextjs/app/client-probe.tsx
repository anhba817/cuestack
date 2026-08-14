'use client'

import { builtinRenderers } from '@cuestack/react'

/**
 * The client side of the boundary, resolving the same specifier through the `default`
 * condition. If the conditions were ordered wrongly this would receive the server
 * entry — which does not throw, and is exactly why the example exists.
 */
export function ClientProbe() {
  return (
    <p>
      Client entry resolved: <code>{builtinRenderers.length} built-in renderers</code>
    </p>
  )
}
