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
 * React-shaped. `question` needs interaction state and gating.
 *
 * **`button` joined in feature 012, and its exclusion was the only one without a reason of its
 * own.** It was out because `on_click` advance was unreachable in *both* adapters — a fact about
 * the framework rather than about this package — and that expired when navigation started working.
 * Leaving it would have defined the covered set partly by an expired excuse, and would have made
 * every slide that waits for a learner a dead end here, since such a slide must carry a control
 * this adapter would then decline to draw. A button renders a label and dispatches intent; it
 * needs no port the others do not have.
 */
export const COVERED = ['text', 'shape', 'image', 'button'] as const

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
