import { ELEMENT_TYPES } from '@cuestack/schema/validate'

/**
 * What this adapter renders, and what it honestly declines to.
 *
 * **One list, read by both the renderers and the unavailable path.** Two would let a type be
 * rendered by one and apologised for by the other, and the result is a blank rectangle with nothing
 * to explain it.
 *
 * The boundary was drawn per type rather than by a rule (research R-03). `text` and `shape` need
 * nothing but their payload. `image` needs an address for an asset id, which is a host capability the
 * React adapter also requires — so it is covered *given* a resolver and reports itself unavailable
 * without one. `video` and `audio` need the media ports and playback synchronisation, which is the
 * React adapter's hardest code and the least likely to say anything about whether the kernel is
 * React-shaped. `question` needs interaction state and gating. `button` is out for a reason that is
 * not this adapter's: `on_click` advance is unreachable in **both** adapters today, so implementing
 * it here would put the two out of step in the opposite direction.
 */
export const COVERED = ['text', 'shape', 'image'] as const

export type CoveredType = (typeof COVERED)[number]

/**
 * Derived rather than written, so a new element type in the format fails the suite until somebody
 * decides which side it belongs on. A hand-written complement would silently absorb it.
 */
export const NOT_COVERED: readonly string[] = ELEMENT_TYPES.filter(
  (type) => !(COVERED as readonly string[]).includes(type),
)

export function covers(type: string): type is CoveredType {
  return (COVERED as readonly string[]).includes(type)
}
