import type { CanvasSize, Geometry, SnapCandidate } from './types.js'

/**
 * What an edge can snap to: the other elements, and the canvas.
 *
 * Three lines per axis for every sibling — near edge, centre, far edge — plus the same three
 * for the canvas itself. That is what makes "line this up with that" and "centre this on the
 * slide" the same gesture rather than two features.
 *
 * **Authored geometry, never visual bounds.** A rotated element's painted corners lie
 * outside its stored box, and snapping to those would write an `x` the teacher cannot see in
 * the inspector and cannot reproduce by typing. The editor does not pretend a rotated
 * element occupies a different rectangle than the one it stores.
 */
export function snapCandidates(
  others: readonly Geometry[],
  canvas: CanvasSize,
): readonly SnapCandidate[] {
  const candidates: SnapCandidate[] = [
    { axis: 'x', at: 0, source: 'canvas-edge' },
    { axis: 'x', at: canvas.width / 2, source: 'canvas-centre' },
    { axis: 'x', at: canvas.width, source: 'canvas-edge' },
    { axis: 'y', at: 0, source: 'canvas-edge' },
    { axis: 'y', at: canvas.height / 2, source: 'canvas-centre' },
    { axis: 'y', at: canvas.height, source: 'canvas-edge' },
  ]

  for (const g of others) {
    candidates.push(
      { axis: 'x', at: g.x, source: 'element-edge' },
      { axis: 'x', at: g.x + g.width / 2, source: 'element-centre' },
      { axis: 'x', at: g.x + g.width, source: 'element-edge' },
      { axis: 'y', at: g.y, source: 'element-edge' },
      { axis: 'y', at: g.y + g.height / 2, source: 'element-centre' },
      { axis: 'y', at: g.y + g.height, source: 'element-edge' },
    )
  }

  return candidates
}
