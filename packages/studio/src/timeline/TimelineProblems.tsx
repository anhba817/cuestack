import type { ReactNode } from 'react'
import type { Slide } from '@cuestack/schema'
import type { RenderProblem } from '@cuestack/core'
import { isWholeSlideOverrun, requiredDurationMs } from './overrun.js'

export interface TimelineProblemsProps {
  readonly slide: Slide
  readonly problems: readonly RenderProblem[]
  readonly disabled: boolean
  readonly onExtend: () => void
}

const seconds = (ms: number): string => (ms / 1000).toFixed(1)

/**
 * Overruns, where the teacher is already looking.
 *
 * BR-017 has been unenforceable since Wave 0, and feature 005 deliberately left it that way:
 * it recorded that the editor must not silently clamp, and that the warning belonged to
 * validation. A timeline is the first surface that can *show* an overrun rather than describe
 * one.
 *
 * **The kernel's own wording is reused rather than rewritten.** Each `RenderProblem` already
 * names the problem, the element, and what to do about it — "either extend the slide or trim
 * the element" — so composing a second message here would be two answers to one question,
 * and the other one is what a validator would print.
 *
 * PB-1 still owns blocking a *publish*. This shows a teacher where the problem is while they
 * are looking at it, which is a different job.
 */
export function TimelineProblems({ slide, problems, disabled, onExtend }: TimelineProblemsProps): ReactNode {
  // Renders nothing at all when there is nothing to say (US5 §5). An empty panel that is
  // always present teaches people to stop reading it.
  if (problems.length === 0) return null

  const target = requiredDurationMs(slide)
  const wholeSlide = isWholeSlideOverrun(slide, problems)

  return (
    <section className="cs-timeline-problems" aria-label="Timing problems" role="status">
      {wholeSlide ? (
        /**
         * A zero-duration slide reports every element, correctly — `collectProblems` tests
         * `endMs > durationMs` and every element has `endMs >= 1`. Repeating that once per
         * element would bury the actual problem, which is about the slide.
         */
        <p>
          {`This slide lasts ${seconds(slide.durationMs)} seconds, so nothing on it has time to ` +
            `finish. All ${problems.length} elements run past the end.`}
        </p>
      ) : (
        <ul>
          {problems.map((problem) => (
            <li key={`${problem.code}-${problem.elementId ?? ''}-${problem.effectId ?? ''}`}>
              {problem.message}
            </li>
          ))}
        </ul>
      )}

      <button type="button" disabled={disabled} onClick={onExtend}>
        {`Extend the slide to ${seconds(target)} seconds`}
      </button>
    </section>
  )
}
