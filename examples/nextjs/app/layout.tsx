import type { ReactNode } from 'react'
import '@cuestack/react/styles.css'

/**
 * The player's stylesheet, imported the way a host would.
 *
 * This import is the demonstration. It failed for most of Wave 2, and the diagnosis was
 * wrong twice: the export map was blamed, when the actual faults were that `dist/styles.css`
 * was a copy of a two-line file whose `@import`s pointed at files never placed in dist, and
 * that attw's complaint was about types, which a stylesheet does not have. Neither had
 * anything to do with Turbopack.
 *
 * Kept here rather than in the page, because a stylesheet belongs to the document and a host
 * imports it once.
 */
export const metadata = { title: 'Cuestack — React SSR Player' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
