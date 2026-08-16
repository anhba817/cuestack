import type { CanvasSize } from '../geometry/types.js'

/**
 * The only module in this package that measures anything.
 *
 * A pointer event arrives in screen pixels; the manifest stores logical units. Something has
 * to convert, and converting needs the stage's rendered width — which exists only in the
 * layout, because `stage.css` sizes everything in container query units and no number for it
 * is ever held in JavaScript. That is the whole design of Wave 2's scaling and the reason a
 * server can emit a correct first paint.
 *
 * So the measurement is quarantined rather than avoided:
 *
 * - **Once per gesture, not per move.** `scaleOf` is called at pointer-down and the result
 *   carried through the drag. A rect read per `pointermove` would be a forced layout on
 *   every frame, which SC-001's 100 ms budget cannot spare at 300 elements.
 * - **At the input edge, never on the render path.** Nothing here participates in producing
 *   the DOM. The server-rendering and hydration properties NX-2 bought are untouched.
 * - **Enforced, not intended.** `dom-measurement-confined` in the shared ESLint config
 *   forbids `getBoundingClientRect`, `offsetWidth`, and `clientWidth` everywhere else in
 *   this package.
 *
 * `toLogicalDelta` takes the scale rather than reading it, which is what makes the
 * interesting half testable in an environment where a bounding rect reports zero
 * (research R-04).
 */

/**
 * How many screen pixels one logical unit currently occupies.
 *
 * Returns `null` when the stage has not been laid out — which is every call under happy-dom,
 * and a real transient in a browser before first paint. A caller that treats null as "cannot
 * convert yet" degrades to doing nothing, rather than dividing by zero and writing `Infinity`
 * into the manifest.
 */
export function scaleOf(stage: Element, canvas: CanvasSize): number | null {
  const rect = stage.getBoundingClientRect()
  if (rect.width <= 0 || canvas.width <= 0) return null
  return rect.width / canvas.width
}

export interface LogicalDelta {
  readonly dx: number
  readonly dy: number
}

/** Screen pixels to logical units. Pure: the scale is supplied, never discovered. */
export function toLogicalDelta(screenDx: number, screenDy: number, scale: number): LogicalDelta {
  if (!Number.isFinite(scale) || scale <= 0) return { dx: 0, dy: 0 }
  return { dx: screenDx / scale, dy: screenDy / scale }
}
