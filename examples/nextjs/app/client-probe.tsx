'use client'

import { ENTRY_KIND } from '@cuestack/react'

/**
 * The client side of the boundary. The same specifier as page.tsx uses, but
 * resolved through the `default` condition rather than `react-server`.
 *
 * If the conditions were ordered wrongly, this would import the server entry
 * and this would read `server` — visible here, invisible everywhere else.
 */
export function ClientProbe() {
  return (
    <p>
      Resolved from a client component: <code>ENTRY_KIND = {ENTRY_KIND}</code>
    </p>
  )
}
