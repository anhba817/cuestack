/**
 * Named, bounded, and expressed in logical canvas units.
 *
 * The project's precedent is `MEDIA_SYNC_TOLERANCE_MS`: a tolerance that matters is a named
 * export with its bounds written down, not a number buried in a comparison. Logical units
 * rather than screen pixels, because Wave 2's win was that nothing measures anything and a
 * screen-pixel threshold would reintroduce that dependency for a feel improvement
 * (clarification Q5, research R-04).
 *
 * For scale: the 16:9 logical canvas is 1600 × 900.
 */

/**
 * How close an edge must come before it snaps.
 *
 * **Bounds.** Zero disables snapping entirely — a valid configuration, and the negative
 * control the snap suite uses to prove the threshold is doing the work. Above roughly 24 on
 * a 1600-unit canvas, unrelated edges start capturing each other and the teacher fights the
 * guide rather than using it.
 */
export const SNAP_THRESHOLD_UNITS = 8

/** One arrow press. The smallest change the manifest can meaningfully express. */
export const NUDGE_UNITS = 1

/** One arrow press with a modifier held. */
export const NUDGE_UNITS_COARSE = 10

/**
 * The floor a resize stops at, rather than producing a manifest the schema rejects.
 *
 * `logicalExtent` is `positive()`, so zero is invalid and a resize dragged past the origin
 * must stop somewhere. One unit is the smallest thing the format can describe; clamping
 * here is what keeps FR-007 true without the reducer having to refuse a live drag.
 */
export const MIN_EXTENT_UNITS = 1

/** How far a duplicate is offset from its source, so it is visibly a second element. */
export const DUPLICATE_OFFSET_UNITS = 20
