'use client'

import type { ReactNode } from 'react'

export interface LessonProgressProps {
  /** Zero-based. */
  readonly slideIndex: number
  readonly slideCount: number
  /** Slides reached, so seeking backwards does not reduce progress. */
  readonly visited: ReadonlySet<number>
}

/**
 * Where the learner is in the lesson.
 *
 * **Slides, not time.** A lesson's slides have wildly different durations, so a time bar
 * would tell a learner they are 30% through when they have seen two slides of ten. Slides are
 * the unit an author composed in and the unit a learner perceives.
 *
 * **Counts slides visited, not the current index.** Seeking backwards to re-read something
 * must not un-earn progress already made — a bar that goes down when a learner reviews
 * punishes reviewing.
 *
 * Shown only when a host enables it (FR-020). The format carries no such field: FR-PLY-013
 * says "where enabled by the teacher or organization", adding one is a migration, and the
 * organisation half is BR-012 in Wave 5. A host option satisfies the requirement now without
 * freezing a format decision early.
 */
export function LessonProgress({ slideIndex, slideCount, visited }: LessonProgressProps): ReactNode {
  const reached = Math.max(visited.size, 1)
  const percent = slideCount === 0 ? 0 : Math.round((reached / slideCount) * 100)

  return (
    <div className="cs-progress">
      <div
        className="cs-progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={slideCount}
        aria-valuenow={reached}
        /* "3 of 10" is what a learner needs. A screen reader reading "30" tells them a number
           and not a position. */
        aria-valuetext={`Slide ${slideIndex + 1} of ${slideCount}`}
        style={{ '--cs-progress': String(percent) } as React.CSSProperties}
      >
        <div className="cs-progress-fill" />
      </div>
      <span className="cs-progress-label">
        {slideIndex + 1} / {slideCount}
      </span>
    </div>
  )
}
