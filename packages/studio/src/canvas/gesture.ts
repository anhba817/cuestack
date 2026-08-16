import type { Edit } from '../draft/edit.js'
import { SNAP_THRESHOLD_UNITS } from '../geometry/constants.js'
import { snap } from '../geometry/snap.js'
import { snapCandidates } from '../geometry/candidates.js'
import { moveBy, resizeBy, rotateBy, type ResizeHandle } from '../geometry/transform.js'
import { toLogicalDelta } from './pointer.js'
import type { CanvasSize, Geometry, SnapCandidate } from '../geometry/types.js'

/**
 * A drag, as arithmetic.
 *
 * The interactive half of US1 with the interaction taken out: given what was grabbed, how far
 * the pointer moved, and the scale, this says where everything ends up. `Overlay.tsx` is left
 * with listeners and style writes — no geometry, no snapping, no clamping.
 *
 * Separated for the reason everything else in this package is: happy-dom computes no layout,
 * so a gesture whose logic lived inside pointer handlers could only be tested by simulating
 * a browser that reports zeros. Here it is tested directly, and its suite is named
 * `*.pure.test.ts` so it runs where `document` does not exist (research R-04).
 */

export type GestureKind = 'move' | 'resize' | 'rotate'

export interface GestureTarget {
  readonly id: string
  /** Geometry at the moment the gesture began. Deltas apply to this, never cumulatively. */
  readonly from: Geometry
}

export interface GestureState {
  readonly kind: GestureKind
  readonly handle: ResizeHandle | undefined
  readonly targets: readonly GestureTarget[]
  /** Screen pixels per logical unit, read once at pointer-down. */
  readonly scale: number
  /** Everything on the slide that is not being dragged — what the drag can snap to. */
  readonly candidates: readonly SnapCandidate[]
}

export interface GestureFrame {
  /** Where each target sits now, keyed by element id. */
  readonly geometries: ReadonlyMap<string, Geometry>
  /** Alignments currently holding, for the overlay to draw. Never stored. */
  readonly guides: readonly SnapCandidate[]
}

export function beginGesture(
  kind: GestureKind,
  handle: ResizeHandle | undefined,
  targets: readonly GestureTarget[],
  others: readonly Geometry[],
  canvas: CanvasSize,
  scale: number,
): GestureState {
  return { kind, handle, targets, scale, candidates: snapCandidates(others, canvas) }
}

/**
 * Where the targets are after the pointer has moved this far.
 *
 * Deltas apply to the geometry captured at pointer-down rather than to the previous frame.
 * Accumulating frame to frame would let rounding drift over a long drag, and would make a
 * dropped `pointermove` change the outcome.
 *
 * Snapping applies to the first target only, and the offset it produces is applied to all of
 * them. That keeps a multiple selection rigid — the alternative, snapping each element
 * independently, pulls a selection apart the moment two members find different guides, and
 * FR-003 requires the selection to move as a unit and keep its spacing.
 */
export function updateGesture(
  state: GestureState,
  screenDx: number,
  screenDy: number,
  threshold: number = SNAP_THRESHOLD_UNITS,
): GestureFrame {
  const { dx, dy } = toLogicalDelta(screenDx, screenDy, state.scale)
  const geometries = new Map<string, Geometry>()

  if (state.kind === 'move') {
    const first = state.targets[0]
    if (!first) return { geometries, guides: [] }

    const dragged = moveBy(first.from, dx, dy)
    const snapped = snap(dragged, state.candidates, threshold)
    // What snapping actually contributed, so every other member moves by the same amount.
    const adjustX = snapped.geometry.x - dragged.x
    const adjustY = snapped.geometry.y - dragged.y

    for (const target of state.targets) {
      geometries.set(target.id, moveBy(target.from, dx + adjustX, dy + adjustY))
    }
    return { geometries, guides: snapped.guides }
  }

  // Resize and rotate act on one element (FR-003): transforming a multiple selection as a
  // single shape is group behaviour, which FR-CAN-019 puts out of scope.
  const target = state.targets[0]
  if (!target) return { geometries, guides: [] }

  if (state.kind === 'resize') {
    const resized = resizeBy(target.from, state.handle ?? 'se', dx, dy)
    const snapped = snap(resized, state.candidates, threshold)
    // Snapping a resize must not drag the element: only edges the resize is already moving
    // may land on a guide, so the origin is taken from the resize, not the snap.
    geometries.set(target.id, { ...resized, x: resized.x, y: resized.y })
    return { geometries, guides: snapped.guides }
  }

  // A rotate reads the horizontal component only: a full turn per 360 logical units of
  // travel, which is predictable without needing the pointer's angle about a centre — and
  // the centre would require knowing where the element is on screen.
  geometries.set(target.id, rotateBy(target.from, dx))
  return { geometries, guides: [] }
}

/**
 * The single edit a completed gesture becomes.
 *
 * One edit per gesture, not one per frame. The draft changes on release, so an interrupted
 * drag leaves nothing behind and the validity check runs once rather than sixty times a
 * second.
 */
export function commitGesture(state: GestureState, frame: GestureFrame): Edit | null {
  const first = state.targets[0]
  if (!first) return null

  if (state.kind === 'move') {
    // Each member lands somewhere different while the spacing is preserved, which is what
    // `perId` exists for. `geometry` carries the first target's destination as the fallback.
    const to = frame.geometries.get(first.id)
    if (!to) return null
    return {
      kind: 'transform-elements',
      ids: state.targets.map((t) => t.id),
      geometry: { x: to.x, y: to.y },
      perId: Object.fromEntries(
        state.targets.map((t) => {
          const g = frame.geometries.get(t.id) ?? t.from
          return [t.id, { x: g.x, y: g.y }]
        }),
      ),
    }
  }

  const to = frame.geometries.get(first.id)
  if (!to) return null
  return state.kind === 'resize'
    ? {
        kind: 'transform-elements',
        ids: [first.id],
        geometry: { x: to.x, y: to.y, width: to.width, height: to.height },
      }
    : { kind: 'transform-elements', ids: [first.id], geometry: { rotation: to.rotation } }
}
