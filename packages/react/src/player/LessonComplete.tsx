'use client'

import type { ReactNode } from 'react'

export interface LessonCompleteProps {
  readonly onReview: () => void
  /** The lesson's title, so the state names what was completed. */
  readonly title?: string
}

/**
 * The state after the final slide (FR-021, FR-022).
 *
 * A lesson that simply stops is indistinguishable from one that broke. A learner who reaches
 * the end and sees the last slide sitting there will wait, and then wonder.
 *
 * Announced, because "the lesson ended" is exactly the kind of change a learner using a
 * screen reader has no other way to notice — there is no visual cue to miss, there is
 * nothing at all.
 *
 * And escapable: FR-022 requires a way back into the lesson. Trapping someone at the end so
 * they must reload to review is worse than not having an end state.
 */
export function LessonComplete({ onReview, title }: LessonCompleteProps): ReactNode {
  return (
    <div className="cs-complete" role="status" aria-live="polite">
      <p className="cs-complete-message">
        {title ? `You have reached the end of ${title}.` : 'You have reached the end of this lesson.'}
      </p>
      <button className="cs-complete-button" type="button" onClick={onReview}>
        Review the lesson
      </button>
    </div>
  )
}
