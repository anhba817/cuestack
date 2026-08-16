import { MIN_EXTENT_UNITS } from './constants.js'
import type { Geometry } from './types.js'

/**
 * Move, resize, and rotate — logical units in, logical units out, no DOM.
 *
 * The half of dragging that is worth testing, separated from the half that is not. A pointer
 * event arrives in screen pixels and has to be converted; that conversion is `pointer.ts`'s
 * single job, at the input edge, in a browser. Everything here is arithmetic over the units
 * the manifest stores, which is why it runs in an environment with no layout engine at all
 * (research R-04).
 *
 * Nothing clamps to the canvas. An element may legitimately begin off-stage and slide in, so
 * a transform that pulled it back inside would break a pattern the format supports — the
 * editor *indicates* off-canvas geometry instead (spec Edge Cases #1).
 */

/** Which handle is being dragged. Corners resize both axes; edges resize one. */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export function moveBy(geometry: Geometry, dx: number, dy: number): Geometry {
  return { ...geometry, x: geometry.x + dx, y: geometry.y + dy }
}

/**
 * Resize from a handle.
 *
 * A north or west drag moves the origin as well as the extent, which is what makes the
 * opposite edge stay put — the property a teacher actually perceives as "resizing from this
 * corner". The clamp is on the *extent*, and the origin is derived from it afterwards, so a
 * drag pushed past collapse stops with the far edge where it was rather than inverting the
 * element.
 */
export function resizeBy(
  geometry: Geometry,
  handle: ResizeHandle,
  dx: number,
  dy: number,
): Geometry {
  const west = handle.includes('w')
  const east = handle.includes('e')
  const north = handle.startsWith('n')
  const south = handle.startsWith('s')

  let { x, y, width, height } = geometry

  if (east) width = clampExtent(width + dx)
  if (west) {
    width = clampExtent(width - dx)
    x = geometry.x + geometry.width - width
  }
  if (south) height = clampExtent(height + dy)
  if (north) {
    height = clampExtent(height - dy)
    y = geometry.y + geometry.height - height
  }

  return { ...geometry, x, y, width, height }
}

/**
 * Rotate, leaving stored position untouched.
 *
 * `ResolvedElement.geometry` is documented as authored position — "effects do NOT mutate
 * this" — and the same holds for rotation: an element spun 45° is still authored where it
 * was, and the inspector must keep showing that. Normalised to one turn so the inspector
 * never shows 730°.
 */
export function rotateBy(geometry: Geometry, degrees: number): Geometry {
  const turned = (geometry.rotation + degrees) % 360
  return { ...geometry, rotation: turned < 0 ? turned + 360 : turned }
}

const clampExtent = (value: number): number => Math.max(MIN_EXTENT_UNITS, value)
