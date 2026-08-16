import type { ReactNode } from 'react'
import '@cuestack/studio/styles.css'

/**
 * The editor's stylesheet, scoped to the authoring route.
 *
 * A route layout rather than the root one, because this is the only place it belongs: the
 * player's stylesheet is document-wide and a learner needs it on every page, while nothing
 * outside `/edit` renders an overlay.
 *
 * It is not optional decoration. Without it the overlay has no `pointer-events: none`, so it
 * swallows every click meant for the canvas beneath; hit targets and selection indicators are
 * unpositioned; and the announcer — which is clipped to a single pixel by CSS so it reaches a
 * screen reader and nothing else — renders as visible text in the middle of the page.
 *
 * That was the state this route shipped in until the manual accessibility pass was set up and
 * the missing import was the first thing found. A build cannot catch it: a stylesheet has no
 * types, so nothing fails, and the page merely looks wrong to whoever opens it.
 */
export const metadata = { title: 'Cuestack — Studio' }

export default function EditLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
