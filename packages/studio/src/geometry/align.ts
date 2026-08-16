import type { AlignEdge, DistributeAxis } from '../draft/edit.js'
import type { Geometry } from './types.js'

/**
 * Alignment and distribution, in logical units, with no DOM.
 *
 * Pure functions over geometry lists: given the selection's geometries, return the same
 * geometries moved. Nothing here knows about elements, the draft, or a display size — which
 * is what lets the whole of FR-006 be tested in the node project (research R-04).
 */

/**
 * Align every geometry to the selection's extreme on that edge.
 *
 * The reference is the selection itself rather than the canvas: a teacher aligning three
 * boxes to the left means "to the leftmost of these three", not "to the canvas edge". The
 * canvas is a snap candidate during a drag (`snap.ts`), which is a different affordance.
 */
export function alignEdges(geometries: readonly Geometry[], edge: AlignEdge): readonly Geometry[] {
  if (geometries.length === 0) return geometries

  const lefts = geometries.map((g) => g.x)
  const rights = geometries.map((g) => g.x + g.width)
  const tops = geometries.map((g) => g.y)
  const bottoms = geometries.map((g) => g.y + g.height)

  switch (edge) {
    case 'left': {
      const target = Math.min(...lefts)
      return geometries.map((g) => ({ ...g, x: target }))
    }
    case 'right': {
      const target = Math.max(...rights)
      return geometries.map((g) => ({ ...g, x: target - g.width }))
    }
    case 'top': {
      const target = Math.min(...tops)
      return geometries.map((g) => ({ ...g, y: target }))
    }
    case 'bottom': {
      const target = Math.max(...bottoms)
      return geometries.map((g) => ({ ...g, y: target - g.height }))
    }
    case 'centre-x': {
      const centre = (Math.min(...lefts) + Math.max(...rights)) / 2
      return geometries.map((g) => ({ ...g, x: centre - g.width / 2 }))
    }
    case 'centre-y': {
      const centre = (Math.min(...tops) + Math.max(...bottoms)) / 2
      return geometries.map((g) => ({ ...g, y: centre - g.height / 2 }))
    }
  }
}

/**
 * Equalise the gaps between adjacent elements along one axis.
 *
 * The outermost two stay put and define the span; everything between them is spread so the
 * *gaps* are equal, not the centres. Equal centres is the other common reading and it looks
 * wrong whenever the elements differ in size, which on a slide they usually do.
 *
 * Needs three: with two there is one gap and nothing to equalise. The reducer refuses below
 * that with `unsupported` rather than silently doing nothing (FR-006).
 */
export function distributeEvenly(
  geometries: readonly Geometry[],
  axis: DistributeAxis,
): readonly Geometry[] {
  if (geometries.length < 3) return geometries

  const extent = (g: Geometry) => (axis === 'horizontal' ? g.width : g.height)
  const start = (g: Geometry) => (axis === 'horizontal' ? g.x : g.y)

  // Sorted by position, then written back in the caller's order — so the result lines up
  // index-for-index with the selection that was passed in.
  const order = geometries
    .map((g, index) => ({ g, index }))
    .sort((a, b) => start(a.g) - start(b.g))

  const first = order[0]!.g
  const last = order[order.length - 1]!.g
  const span = start(last) + extent(last) - start(first)
  const occupied = order.reduce((sum, { g }) => sum + extent(g), 0)
  const gap = (span - occupied) / (order.length - 1)

  const placed = new Map<number, Geometry>()
  let cursor = start(first)
  for (const { g, index } of order) {
    placed.set(index, axis === 'horizontal' ? { ...g, x: cursor } : { ...g, y: cursor })
    cursor += extent(g) + gap
  }

  return geometries.map((g, i) => placed.get(i) ?? g)
}
