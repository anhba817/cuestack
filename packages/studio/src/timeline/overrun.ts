import type { Element, Slide } from '@cuestack/schema'
import type { RenderProblem, RenderState } from '@cuestack/core'

/**
 * The overruns the kernel already found.
 *
 * `collectProblems` has emitted `ELEMENT_BEYOND_SLIDE` and `EFFECT_BEYOND_SLIDE` on every
 * resolve since Wave 1, and **nothing has ever read them**: the problems have been carried,
 * unexamined, through three features. FR-TIM-016 asks for exactly what already exists, so
 * this is a filter, not a detector.
 *
 * Detecting them here instead would be two implementations of one rule, and the kernel's is
 * the one the player already uses. It would also mean the editor could disagree with the
 * validator about whether a lesson has a problem, which is the class of divergence
 * Constitution V exists to prevent.
 *
 * Each problem already carries `elementId`, optionally `effectId`, and a message naming the
 * problem, the element, and the action — so FR-040 is satisfied by the kernel's own wording
 * rather than by a second message composed here.
 */
export function overrunsOf(state: RenderState): readonly RenderProblem[] {
  return state.problems.filter(
    (problem) => problem.code === 'ELEMENT_BEYOND_SLIDE' || problem.code === 'EFFECT_BEYOND_SLIDE',
  )
}

/**
 * How long the slide would have to be to contain everything on it.
 *
 * Arithmetic over the same data the problems come from: the latest end across every element
 * and every effect. Computed here rather than accepted from a surface, because FR-038 is an
 * *offer with a computed target* — a control that could supply a different number would let
 * the extend action produce a slide that still overruns.
 *
 * Returns the slide's own duration when nothing exceeds it, so the caller can compare rather
 * than special-case the empty answer.
 */
export function requiredDurationMs(slide: Slide): number {
  let latest = slide.durationMs
  for (const element of slide.elements as readonly Element[]) {
    const el = element as unknown as {
      endMs: number
      effects?: readonly { startMs: number; durationMs: number }[]
    }
    if (el.endMs > latest) latest = el.endMs
    for (const effect of el.effects ?? []) {
      const end = effect.startMs + effect.durationMs
      if (end > latest) latest = end
    }
  }
  return latest
}

/**
 * Whether every element on the slide overruns, which is what a zero-duration slide produces.
 *
 * `collectProblems` tests `endMs > slide.durationMs`, and every element has `endMs >= 1` — so
 * a slide of duration zero reports *every* element. That is the kernel answering correctly;
 * repeating it once per element would bury the actual problem, which is about the slide.
 */
export function isWholeSlideOverrun(slide: Slide, problems: readonly RenderProblem[]): boolean {
  const elements = slide.elements as readonly Element[]
  if (elements.length === 0) return false
  const named = new Set(problems.map((p) => p.elementId).filter(Boolean))
  return named.size === elements.length && elements.length > 1
}
