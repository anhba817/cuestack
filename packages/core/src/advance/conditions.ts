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
