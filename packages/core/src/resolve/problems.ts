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

  /**
   * A `next_slide` control on a slide that waits for something else can never be operated.
   *
   * **A finding, not a dead end**, and the distinction decides its severity: the slide is
   * satisfiable through its own gate, so refusing to publish would refuse a working lesson. What
   * it prevents is this framework's own defect one level up — a control that does nothing and
   * nobody is told. After navigation works, such a button is permanently disabled, and without
   * this a teacher places one, publishes, and it renders that way forever with no explanation.
   *
   * Here rather than in `checkReachability` because that function answers a learner-facing
   * question — *is this slide a wall* — and returns the `BlockingProblem` a learner is shown.
   * This is authoring feedback about a slide that is not a wall at all.
   */
  const mode = slide.advance.mode
  if (mode === 'after_interaction' || mode === 'after_media_ends') {
    for (const element of slide.elements as readonly Element[]) {
      if (element.type !== 'button') continue
      if ((element.payload as { action?: string } | undefined)?.action !== 'next_slide') continue
      problems.push({
        code: 'NAVIGATION_INOPERABLE',
        elementId: element.id,
        message:
          `Button "${element.id}" continues to the next slide, but this slide waits for ` +
          'something else first, so the button can never be operated here. A learner will see it ' +
          'disabled. Remove it, or change how this slide advances.',
      })
    }
  }

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
