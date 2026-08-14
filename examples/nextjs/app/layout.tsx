import type { ReactNode } from 'react'

/**
 * TODO(T073): the stylesheet is not imported yet.
 *
 * `import '@cuestack/react/styles.css'` is the intended usage and the exports map
 * declares it, but Turbopack cannot resolve the subpath from the workspace link —
 * not fixed by dropping transpilePackages, nor by declaring the CSS in
 * `sideEffects`. Until it is resolved the stage renders unpositioned here, which
 * makes this page an incomplete demonstration rather than a wrong one.
 *
 * The scaling assertions in packages/react/test/scaling/ (US3) verify the stylesheet
 * itself, so the mechanism is testable without this. Left explicit rather than
 * worked around with a relative dist path, because a consumer would hit the same wall.
 */
export const metadata = { title: 'Cuestack — React SSR Player' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
