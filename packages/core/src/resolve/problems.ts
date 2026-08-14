import type { Element, Slide } from '@cuestack/schema'
import type { RenderProblem } from './state.js'

/**
 * Non-fatal findings, reported rather than clipped.
 *
 * A teacher who shortened a slide needs to know what they cut off. Silently
 * truncating means discovering it from a learner, which is too late.
 */
export function collectProblems(slide: Slide): RenderProblem[] {
  const problems: RenderProblem[] = []
  for (const element of slide.elements as readonly Element[]) {
    if (element.endMs > slide.durationMs) {
      problems.push({
        code: 'ELEMENT_BEYOND_SLIDE',
        elementId: element.id,
        message:
          `Element "${element.id}" is scheduled until ${element.endMs}ms but the slide ends at ` +
          `${slide.durationMs}ms. It is not clipped — either extend the slide or trim the element.`,
      })
    }
    for (const effect of element.effects ?? []) {
      if (effect.startMs + effect.durationMs > slide.durationMs) {
        problems.push({
          code: 'EFFECT_BEYOND_SLIDE',
          elementId: element.id,
          effectId: effect.id,
          message:
            `Effect "${effect.id}" on "${element.id}" runs until ` +
            `${effect.startMs + effect.durationMs}ms but the slide ends at ${slide.durationMs}ms, ` +
            'so the learner never sees it finish.',
        })
      }
    }
  }
  return problems
}
