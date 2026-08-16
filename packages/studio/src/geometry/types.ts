/**
 * Geometry, in logical canvas units and nothing else.
 *
 * Mirrors the manifest's element fields rather than wrapping them, so a transform's output
 * can be written straight back. Nothing here knows a display size exists: that is what makes
 * FR-009 checkable — the same logical delta yields the same geometry because the engine is
 * never told one (research R-04).
 */
export interface Geometry {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly rotation: number
}

/** A partial change to geometry. Absent members are left alone. */
export type GeometryDelta = Partial<Geometry>

export type SnapAxis = 'x' | 'y'

/** Where a snap candidate came from, so the overlay can draw a guide the teacher recognises. */
export type SnapSource = 'element-edge' | 'element-centre' | 'canvas-edge' | 'canvas-centre'

export interface SnapCandidate {
  readonly axis: SnapAxis
  readonly at: number
  readonly source: SnapSource
}

export interface SnapResult {
  readonly geometry: Geometry
  /** Transient. Drawn by the overlay, never stored (FR-044). */
  readonly guides: readonly SnapCandidate[]
}

/** The logical canvas an element's geometry is expressed against. */
export interface CanvasSize {
  readonly width: number
  readonly height: number
}
