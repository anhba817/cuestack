/**
 * Named, bounded, and expressed in the units the lesson format stores.
 *
 * The precedent is `geometry/constants.ts`, and the reasoning transfers: a tolerance that
 * matters is a named export with its bounds written down, not a number buried in a
 * comparison. Milliseconds rather than pixels, for the same reason geometry uses logical
 * units — a pixel threshold would make the feel depend on the time scale, and the teacher
 * would find snapping stronger when zoomed in.
 *
 * For scale: a typical slide is 5 000–30 000 ms.
 */

/**
 * How close a dragged edge must come to another event's boundary before it snaps.
 *
 * **Bounds.** Zero disables snapping entirely — a valid configuration, and the negative
 * control the snap suite uses to prove the threshold is doing the work. Below roughly 30 ms
 * the target is unreachable at ordinary scales; above roughly 150 ms unrelated events begin
 * capturing each other and the teacher fights the guide rather than using it.
 */
export const SNAP_THRESHOLD_MS = 80

/**
 * The floor a resize stops at, rather than producing a manifest the schema rejects.
 *
 * `elementSchema` refines `endMs > startMs`, so the shortest legal element is one
 * millisecond. Clamping here is what keeps FR-014 true without the reducer having to refuse
 * a live drag — the same shape as `MIN_EXTENT_UNITS` in geometry.
 */
export const MIN_ELEMENT_DURATION_MS = 1

/**
 * The same floor for an effect, under a different schema rule.
 *
 * `msDuration` is `z.int().positive()`, so zero is not "instant" — `appear` is. FR-023
 * surfaces that as a refusal with a reason rather than a schema path.
 */
export const MIN_EFFECT_DURATION_MS = 1

/** One arrow press on a track. */
export const NUDGE_MS = 10

/** One arrow press with a modifier held. */
export const NUDGE_MS_COARSE = 100

/**
 * How long a newly added effect runs.
 *
 * FR-019 requires a new effect to be immediately valid *and* immediately visible. A
 * duration too short to see would satisfy the schema and fail the requirement.
 */
export const DEFAULT_EFFECT_DURATION_MS = 400

/**
 * Time-scale bounds, in CSS pixels per second of lesson time.
 *
 * The lower bound keeps a one-millisecond bar hittable via `MIN_BAR_PX`; below it a
 * ten-second slide collapses into a few pixels and nothing is grabbable. The upper bound
 * keeps a ten-minute slide scrollable rather than unreachable.
 */
export const MIN_PX_PER_SECOND = 20
export const MAX_PX_PER_SECOND = 800

/**
 * The narrowest a bar is ever drawn.
 *
 * A bar too small to hit is a bar that cannot be edited, and a one-millisecond window is
 * authorable (spec edge case). **Presentation only** — it never changes a stored value, and
 * the scale still reports the true time under the cursor.
 */
export const MIN_BAR_PX = 8
