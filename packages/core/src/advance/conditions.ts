import type { Element, Slide } from '@cuestack/schema'
import type { MediaPort } from '../ports/media.js'

export interface AdvanceSignals {
  /** The learner asked to move on. */
  readonly learnerAdvanced: boolean
  /** Ids of interaction elements the learner has completed. */
  readonly completedInteractions: ReadonlySet<string>
  /** Test and preview; inert unless the controller was built to allow it (FR-024).
   *  Two conditions, deliberately independent — see `AdvanceControllerOptions`. */
  readonly overrideAdvance?: boolean
}

export interface ConditionContext {
  readonly slide: Slide
  readonly slideTimeMs: number
  readonly signals: AdvanceSignals
  readonly media: MediaPort
}

const elementsOf = (slide: Slide): readonly Element[] => slide.elements as readonly Element[]

export function findElement(slide: Slide, id: string | undefined): Element | undefined {
  if (!id) return undefined
  return elementsOf(slide).find((e) => e.id === id)
}

export function isRequiredQuestion(element: Element | undefined): boolean {
  if (!element || element.type !== 'question') return false
  const payload = element.payload as { required?: unknown }
  return payload?.required === true
}

/**
 * BR-005: an incomplete required interaction outranks the duration timer.
 *
 * Applies to every required question on the slide, not only one named by an
 * advance rule — a duration-advanced slide carrying a required question must also
 * wait, or the learner loses the question entirely.
 */
export function hasIncompleteRequiredInteraction(ctx: ConditionContext): boolean {
  return elementsOf(ctx.slide).some(
    (element) => isRequiredQuestion(element) && !ctx.signals.completedInteractions.has(element.id),
  )
}

/**
 * Would anything refuse a learner who asked to leave this slide right now?
 *
 * **Deliberately not "would this slide advance now".** A Continue button on a timed slide is a
 * skip-ahead: it must be operable from the first frame, long before the clock would move the
 * learner on by itself. So the duration is not consulted, and `after_duration` says yes.
 *
 * **Pure, and that is the point.** The same question is answered inside `evaluate`, which records
 * that a slide has decided — so an adapter computing a control's availability by calling
 * `evaluate` consumes the decision the slide needed, and the slide never advances again. Asking
 * has to be free, and this is the form that is.
 *
 * It is exported from the package for the other half of that problem: the conditions below reach
 * no adapter, since `@cuestack/core` has a single entry point. Without this, BR-005 gets a second
 * and a third implementation in `@cuestack/react` and `@cuestack/element`, and they diverge.
 *
 * Two conditions refuse:
 *
 * - **BR-005** — a required question not yet answered, on *every* advance mode. The kernel
 *   enforces this before it reaches the mode branches, and a rule that enumerated the modes
 *   would let a Continue button skip a required question on a timed slide.
 * - **A mode that declares its own gate** — `after_interaction`, `after_media_ends`. Nothing a
 *   learner asks satisfies these; the slide leaves by its own rule or not at all.
 */
export function learnerMayLeave(slide: Slide, signals: AdvanceSignals): boolean {
  if (hasIncompleteRequiredInteraction({ slide, slideTimeMs: 0, signals, media: NO_MEDIA })) {
    return false
  }
  const mode = slide.advance.mode
  return mode !== 'after_interaction' && mode !== 'after_media_ends'
}

/**
 * A media port for the one condition above that does not consult media.
 *
 * `hasIncompleteRequiredInteraction` reads only the slide and the signals, and takes a full
 * `ConditionContext` because every other condition needs one. Passing a null port is honest here
 * rather than lazy: there is no media question being asked.
 */
const NO_MEDIA: MediaPort = {
  query: () => null,
  subscribe: () => () => undefined,
  play: () => undefined,
  pause: () => undefined,
  seek: () => undefined,
}

export function durationElapsed(ctx: ConditionContext): boolean {
  return ctx.slideTimeMs >= ctx.slide.durationMs
}

/**
 * A paused video postpones rather than cancels: pausing changes what the port
 * reports, and a later evaluation with the media ended still decides. No
 * cancellation state is needed (research R-04).
 */
export function mediaEnded(ctx: ConditionContext, mediaElementId: string | undefined): boolean {
  if (!mediaElementId) return false
  const status = ctx.media.query(mediaElementId)
  return status?.ended === true
}

export function interactionCompleted(
  ctx: ConditionContext,
  interactionElementId: string | undefined,
): boolean {
  if (!interactionElementId) return false
  return ctx.signals.completedInteractions.has(interactionElementId)
}
