'use client'

import type { ReactNode } from 'react'
import type { PlaybackProblem as Described } from './problems.js'

export interface PlaybackProblemProps {
  readonly problem: Described
  readonly onRetry: () => void
  readonly onSkip: () => void
  readonly canSkip: boolean
}

/**
 * What a learner sees when the lesson cannot continue.
 *
 * The kernel has reported these conditions since Wave 1 and no consumer had ever displayed
 * one — a learner met them as a slide that simply never moved, which is indistinguishable
 * from a broken page and gives them nothing to try.
 *
 * `role="alert"` rather than `status`: this *is* an interruption, unlike the question
 * feedback which reports on something the learner just did. A lesson that has stopped is
 * worth interrupting for.
 *
 * Every control is a real button, keyboard-reachable and named for what it does. A retry is
 * offered only where retrying can change something — a button that cannot help is worse than
 * an honest dead end, because the learner presses it repeatedly before concluding the same
 * thing.
 */
export function PlaybackProblem({ problem, onRetry, onSkip, canSkip }: PlaybackProblemProps): ReactNode {
  return (
    <div className="cs-problem" role="alert">
      <p className="cs-problem-message">{problem.message}</p>
      <p className="cs-problem-action">{problem.action}</p>
      <div className="cs-problem-buttons">
        {problem.retryable ? (
          <button className="cs-problem-button" type="button" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        {canSkip ? (
          <button className="cs-problem-button" type="button" onClick={onSkip}>
            Skip this slide
          </button>
        ) : null}
      </div>
    </div>
  )
}
