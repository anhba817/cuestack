import type { Geometry, SnapAxis, SnapCandidate, SnapResult } from './types.js'

/**
 * Pull an element onto a nearby alignment, exactly.
 *
 * "Exactly" is the requirement worth naming: SC-009 asks that a snapped edge differ from its
 * candidate by *zero* logical units, not that the element move closer. Snapping that merely
 * reduced the gap would look identical on screen and leave a manifest full of 199.7s.
 *
 * The element's three lines on each axis are all eligible — near edge, centre, far edge — so
 * a box can line its right edge up with a neighbour's left. Whichever pairing is closest
 * wins, and only the origin moves: snapping never resizes.
 *
 * Threshold in logical units, and zero disables it. That is a real configuration and the
 * negative control the suite uses to prove the threshold is doing the work rather than the
 * arithmetic happening to land right.
 */
export function snap(
  geometry: Geometry,
  candidates: readonly SnapCandidate[],
  threshold: number,
): SnapResult {
  if (threshold <= 0) return { geometry, guides: [] }

  const x = bestFor(geometry, 'x', candidates, threshold)
  const y = bestFor(geometry, 'y', candidates, threshold)

  const guides: SnapCandidate[] = []
  if (x) guides.push(x.candidate)
  if (y) guides.push(y.candidate)

  return {
    geometry: {
      ...geometry,
      x: x ? geometry.x + x.shift : geometry.x,
      y: y ? geometry.y + y.shift : geometry.y,
    },
    guides,
  }
}

interface Match {
  readonly candidate: SnapCandidate
  /** How far the origin must move so the matched line lands on the candidate exactly. */
  readonly shift: number
  readonly distance: number
}

function bestFor(
  geometry: Geometry,
  axis: SnapAxis,
  candidates: readonly SnapCandidate[],
  threshold: number,
): Match | undefined {
  const origin = axis === 'x' ? geometry.x : geometry.y
  const extent = axis === 'x' ? geometry.width : geometry.height
  // The element's own lines, as offsets from its origin.
  const lines = [0, extent / 2, extent]

  let best: Match | undefined
  for (const candidate of candidates) {
    if (candidate.axis !== axis) continue
    for (const offset of lines) {
      const shift = candidate.at - (origin + offset)
      const distance = Math.abs(shift)
      if (distance > threshold) continue
      if (!best || distance < best.distance) best = { candidate, shift, distance }
    }
  }
  return best
}
