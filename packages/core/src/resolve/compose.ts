import {
  IDENTITY_TRANSFORM,
  type Contribution,
  type FilterDelta,
  type TransformDelta,
} from './contribution.js'

export interface ComposedVisual {
  readonly opacity: number
  readonly transform: TransformDelta
  readonly filter: FilterDelta | null
}

/**
 * Fold a set of contributions into one visual result.
 *
 * Opacities and scales multiply; translations and rotations sum. The operation is
 * therefore associative and commutative, which is what makes each effect
 * computable independently of the others (FR-011) and what stops an ordering bug
 * from ever showing up as a visual difference (research R-02).
 *
 * The filter stays null unless something actually contributed one, so a consumer
 * can skip emitting a filter property at all in the common case.
 */
/** -0 serialises as 0 but fails deep-equal against +0; Wave 2 compares render
 *  states across server and client, so it is normalised at the boundary. */
const zero = (n: number): number => (n === 0 ? 0 : n)

export function composeContributions(contributions: readonly Contribution[]): ComposedVisual {
  let opacity = 1
  let translateX = 0
  let translateY = 0
  let scaleX = 1
  let scaleY = 1
  let rotate = 0
  let brightness = 1
  let blur = 0
  let touchedFilter = false

  for (const c of contributions) {
    if (c.opacity !== undefined) opacity *= c.opacity
    if (c.translate) {
      translateX += c.translate.x
      translateY += c.translate.y
    }
    if (c.scale) {
      scaleX *= c.scale.x
      scaleY *= c.scale.y
    }
    if (c.rotate !== undefined) rotate += c.rotate
    if (c.brightness !== undefined) {
      brightness *= c.brightness
      touchedFilter = true
    }
    if (c.blur !== undefined) {
      blur += c.blur
      touchedFilter = true
    }
  }

  const transform: TransformDelta =
    translateX === 0 && translateY === 0 && scaleX === 1 && scaleY === 1 && rotate === 0
      ? IDENTITY_TRANSFORM
      : {
          translateX: zero(translateX),
          translateY: zero(translateY),
          scaleX: zero(scaleX),
          scaleY: zero(scaleY),
          rotate: zero(rotate),
        }

  return {
    opacity: opacity < 0 ? 0 : opacity > 1 ? 1 : opacity,
    transform,
    filter: touchedFilter ? { brightness, blur } : null,
  }
}
