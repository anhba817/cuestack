/**
 * An effect's partial visual output at one progress value.
 *
 * Contributions compose associatively and commutatively within a phase: opacities
 * and scales multiply, translations and rotations sum. That makes each effect
 * computable independently of every other (FR-011) and means an ordering bug
 * cannot manifest as a visual difference (research R-02).
 *
 * The empty object is the identity, which is why an element with no effects
 * resolves to its authored geometry at full opacity with no special case.
 */
export interface Contribution {
  readonly opacity?: number
  readonly translate?: { readonly x: number; readonly y: number }
  readonly scale?: { readonly x: number; readonly y: number }
  readonly rotate?: number
  readonly brightness?: number
  readonly blur?: number
}

/** The composed offsets applied on top of authored geometry. */
export interface TransformDelta {
  readonly translateX: number
  readonly translateY: number
  readonly scaleX: number
  readonly scaleY: number
  readonly rotate: number
}

export interface FilterDelta {
  readonly brightness: number
  readonly blur: number
}

export const IDENTITY_TRANSFORM: TransformDelta = {
  translateX: 0,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
}
