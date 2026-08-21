import type { AspectRatio } from '@cuestack/schema'
import type { RenderState, ResolvedElement, TransformDelta } from '@cuestack/core'

/**
 * A `RenderState` to style values, applied to a node.
 *
 * **Duplicated deliberately, and it is about forty lines.** Eight modules in `@cuestack/react` do
 * this already and none of them imports React — but reaching them means a web-component adapter
 * declaring a dependency on the React adapter, which is absurd on its face and structurally
 * detectable. Moving them into core would change two shipped packages' surfaces, which belongs in
 * its own feature. So this exists, bounded by the covered set, and the duplication earns its keep:
 * two independent style layers over one kernel is what makes the agreement suite evidence about the
 * kernel rather than a helper compared against itself (research R-01).
 *
 * **The reduced set is written alongside the ordinary one.** Reduced motion is two halves — these
 * values, and the stylesheet's media block choosing between them at paint time. Writing only the
 * ordinary set leaves that block nothing to select, which honours nothing while appearing to.
 */

/** Geometry, which never has a reduced alternative — position is not motion. */
function geometryOf(element: ResolvedElement): Bag {
  return {
    '--cs-x': String(element.geometry.x),
    '--cs-y': String(element.geometry.y),
    '--cs-w': String(element.geometry.width),
    '--cs-h': String(element.geometry.height),
    /**
     * **Authored rotation, which the first two drafts dropped.**
     *
     * `geometry.rotation` is part of `ResolvedElement` and the React player writes it as
     * `--cs-rotation` — distinct from `--cs-rotate`, which is what an *effect* contributes. Omitting
     * it renders an authored rotation as no rotation at all: silent, and invisible to the agreement
     * suite even after that suite was extended to compare effect values, because the fix added the
     * transform set and this is geometry. The lesson is that a defect class is not enumerated by the
     * first instance of it that gets found.
     */
    '--cs-rotation': String(element.geometry.rotation),
    '--cs-z': String(element.zIndex),
  }
}

/**
 * Logical canvas dimensions per aspect ratio.
 *
 * Duplicated from `@cuestack/react`'s `theme/tokens.ts` for the reason research R-01 sets out about
 * the frame layer: reaching it means depending on the React adapter. Six numbers, and a `Record`
 * keyed on `AspectRatio` with no runtime fallback — so a ratio added to the schema is a compile
 * error here rather than a lesson silently rendered as 16:9.
 */
const CANVAS: Record<AspectRatio, { w: number; h: number }> = {
  '16:9': { w: 1600, h: 900 },
  '4:3': { w: 1600, h: 1200 },
  '9:16': { w: 900, h: 1600 },
}

/**
 * The canvas a stage is measured against.
 *
 * **This is what makes the adapter scale like the player rather than render at fixed size.** Every
 * geometry value in a manifest is in logical units, and the stylesheet turns each into a proportion
 * of the canvas using container-query units. Without these two properties the divisor is missing and
 * the whole layout collapses — which is why they are set on the stage before the first frame rather
 * than alongside the elements.
 */
export function canvasPropertiesFor(aspectRatio: AspectRatio): Bag {
  const canvas = CANVAS[aspectRatio]
  return { '--cs-canvas-w': String(canvas.w), '--cs-canvas-h': String(canvas.h) }
}

type Bag = Record<string, string>

/**
 * What an effect can move, written under a prefix.
 *
 * Called twice per element: once bare for the ordinary values and once as `r-` for the reduced
 * alternative. `ResolvedElement.reduced` is null whenever no *moving* effect is active, which is most
 * of the time — and its own header explains why the resolver emits both and branches on neither.
 */
function visualOf(
  opacity: number,
  transform: TransformDelta,
  filter: { brightness: number; blur: number } | null | undefined,
  prefix: string,
  into: Bag,
): void {
  /**
   * **Identity values are omitted, matching `visualProperties` in `@cuestack/react` exactly.**
   *
   * The stylesheet's `var(…, 1)` fallbacks supply the identity, so writing `--cs-opacity: 1` on an
   * element that no effect touches is bytes per element per frame for no pixel — and most elements
   * are untouched most of the time, which is what the player's rule is bounded by.
   *
   * This is here because the agreement suite found it: the first draft wrote all six unconditionally
   * and the two adapters disagreed about `--cs-opacity` on every element at every instant. Nothing
   * looked wrong on screen, because the fallback and the written value were the same number. That is
   * precisely the class of difference the comparison exists to surface — a shared kernel value
   * arriving differently in the two, invisible to the eye and to every other test.
   */
  if (opacity !== 1) into[`--cs-${prefix}opacity`] = String(opacity)
  if (transform.translateX !== 0) into[`--cs-${prefix}tx`] = String(transform.translateX)
  if (transform.translateY !== 0) into[`--cs-${prefix}ty`] = String(transform.translateY)
  if (transform.scaleX !== 1) into[`--cs-${prefix}sx`] = String(transform.scaleX)
  if (transform.scaleY !== 1) into[`--cs-${prefix}sy`] = String(transform.scaleY)
  if (transform.rotate !== 0) into[`--cs-${prefix}rotate`] = String(transform.rotate)

  /**
   * **Filters, which the first draft dropped entirely.**
   *
   * `highlight` and `dim` are two of the eight builtin effects and neither moves anything — they
   * change brightness. An adapter that writes only the transform set renders both as nothing at
   * all: no error, no missing element, just a learner who never sees the thing the author drew
   * attention to. Found by the agreement suite the moment it was asked to compare effect values,
   * and invisible to every test before that because no fixture carried an effect.
   *
   * Written as a pair when `filter` is present, exactly as `visualProperties` does — the identity
   * rule above does not apply, because the kernel emits the whole filter or none of it.
   */
  if (filter) {
    into[`--cs-${prefix}brightness`] = String(filter.brightness)
    into[`--cs-${prefix}blur`] = String(filter.blur)
  }
}

export function propertiesFor(element: ResolvedElement): Bag {
  const bag: Bag = geometryOf(element)
  visualOf(element.opacity, element.transform, element.filter, '', bag)
  if (element.reduced) {
    // The mirrored set. Absent when no moving effect is active, in which case the stylesheet's
    // fallback chain resolves to no motion, which is the right answer for a reduced preference.
    visualOf(element.reduced.opacity, element.reduced.transform, element.reduced.filter, 'r-', bag)
  }
  return bag
}

/**
 * Write the values a node needs, and remove the ones it no longer does.
 *
 * The removal half matters now that identity values are omitted: an element that faded to 0.4 and
 * back to 1 would otherwise keep `--cs-opacity: 0.4` forever, because the frame that returned it to
 * identity writes nothing at all.
 */
export function applyTo(node: HTMLElement, element: ResolvedElement): void {
  const bag = propertiesFor(element)

  // Indexed rather than iterated: `CSSStyleDeclaration` is iterable in browsers and not in
  // happy-dom, and `item(i)` is the form both implement. Collected first, because removing while
  // reading shifts the indices underneath.
  const present: string[] = []
  for (let i = 0; i < node.style.length; i += 1) {
    const property = node.style.item(i)
    if (property.startsWith('--cs-') && !(property in bag)) present.push(property)
  }
  for (const property of present) node.style.removeProperty(property)
  for (const [property, value] of Object.entries(bag)) {
    node.style.setProperty(property, value)
  }
}

/** Every element the kernel says is on screen, in the order it says. */
export const visibleOf = (state: RenderState): readonly ResolvedElement[] => state.elements
