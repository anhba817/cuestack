import type { ResolvedElement } from '@cuestack/core'
import { GEOMETRY, REDUCED, VISUAL, type PropertyBag } from './properties.js'

/**
 * The single conversion between what the kernel computed and what the page shows.
 *
 * Values are emitted as bare numbers, not lengths: the stylesheet turns logical
 * units into container query units. Emitting `120px` here would bake in a scale the
 * server cannot know, which is the whole reason scaling is CSS.
 *
 * Pure, so the server and the client produce identical property bags from identical
 * input — which is what makes hydration match by construction rather than by care.
 */
export function geometryProperties(element: ResolvedElement): PropertyBag {
  return {
    [GEOMETRY.x]: String(element.geometry.x),
    [GEOMETRY.y]: String(element.geometry.y),
    [GEOMETRY.width]: String(element.geometry.width),
    [GEOMETRY.height]: String(element.geometry.height),
    [GEOMETRY.rotation]: String(element.geometry.rotation),
    [GEOMETRY.zIndex]: String(element.zIndex),
  }
}

/** Only what an effect changed. An element with no effects yields nothing, and the
 *  stylesheet's fallbacks supply the identity. */
export function visualProperties(element: ResolvedElement): PropertyBag {
  const bag: PropertyBag = {}

  if (element.opacity !== 1) bag[VISUAL.opacity] = String(element.opacity)

  const t = element.transform
  if (t.translateX !== 0) bag[VISUAL.translateX] = String(t.translateX)
  if (t.translateY !== 0) bag[VISUAL.translateY] = String(t.translateY)
  if (t.scaleX !== 1) bag[VISUAL.scaleX] = String(t.scaleX)
  if (t.scaleY !== 1) bag[VISUAL.scaleY] = String(t.scaleY)
  if (t.rotate !== 0) bag[VISUAL.rotate] = String(t.rotate)

  if (element.filter) {
    bag[VISUAL.brightness] = String(element.filter.brightness)
    bag[VISUAL.blur] = String(element.filter.blur)
  }

  return bag
}

/**
 * The reduced-motion alternative, under mirrored property names.
 *
 * Empty when the kernel says the two do not differ — an element at rest, or one whose only
 * effect is a fade. That is most elements most of the time, which is what bounds the cost of
 * emitting two answers to the frames where they can actually differ.
 *
 * Emitted with the same "only what changed" rule as `visualProperties`, so the stylesheet's
 * fallbacks still supply every identity value.
 */
export function reducedProperties(element: ResolvedElement): PropertyBag {
  const reduced = element.reduced
  if (!reduced) return {}

  const bag: PropertyBag = {}
  if (reduced.opacity !== 1) bag[REDUCED.opacity] = String(reduced.opacity)

  const t = reduced.transform
  if (t.translateX !== 0) bag[REDUCED.translateX] = String(t.translateX)
  if (t.translateY !== 0) bag[REDUCED.translateY] = String(t.translateY)
  if (t.scaleX !== 1) bag[REDUCED.scaleX] = String(t.scaleX)
  if (t.scaleY !== 1) bag[REDUCED.scaleY] = String(t.scaleY)
  if (t.rotate !== 0) bag[REDUCED.rotate] = String(t.rotate)

  if (reduced.filter) {
    bag[REDUCED.brightness] = String(reduced.filter.brightness)
    bag[REDUCED.blur] = String(reduced.filter.blur)
  }

  return bag
}

/**
 * Everything one element contributes to its inline style.
 *
 * Includes the reduced set, and that is not an optimisation detail — this is what the
 * **server** emits, and FR-028 requires the preference honoured on the first painted frame.
 * A first version added the reduced properties to the frame writer only, so they existed
 * during playback and were absent from the very frame the requirement is about.
 */
export function elementProperties(element: ResolvedElement): PropertyBag {
  return {
    ...geometryProperties(element),
    ...visualProperties(element),
    ...reducedProperties(element),
  }
}
