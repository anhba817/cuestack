import { useCallback, useState } from 'react'
import type { LessonManifest } from '@cuestack/schema'
import {
  checkLesson,
  type CheckOptions,
  type ReportIssue,
  type ValidationReport,
} from '@cuestack/core'

/**
 * The report, held for as long as a teacher is looking at it — and no longer.
 *
 * **On request rather than on every keystroke.** The engine is fast enough to run continuously,
 * which is precisely the temptation to resist: a report that changes under someone's hands while
 * they read it is one they stop reading. A teacher asks, fixes something, and asks again.
 *
 * **The report is derived and never stored** (data-model.md §1). It is discarded and remade, so
 * there is nothing here to keep in sync with the draft, and a stale report cannot be mistaken for
 * a current one — `run` replaces it wholesale.
 *
 * No clock. `no-clock-in-studio` bans one in this package, and nothing here wants one: the engine
 * is pure and the report carries no timestamp a teacher would read.
 */
export interface Validation {
  /** Null until the teacher has asked once. Distinct from a report that found nothing. */
  readonly report: ValidationReport | null
  run(): ValidationReport
  clear(): void
  /** FR-005: go to the issue, using the same navigation every other surface uses. */
  jumpTo(issue: ReportIssue): void
}

export interface UseValidationOptions extends CheckOptions {
  readonly draft: LessonManifest
  readonly goToSlide: (slideId: string) => void
  readonly select: (ids: readonly string[]) => void
}

export function useValidation(options: UseValidationOptions): Validation {
  const { draft, goToSlide, select, elements, effects, policy } = options
  const [report, setReport] = useState<ValidationReport | null>(null)

  const run = useCallback((): ValidationReport => {
    const next = checkLesson(draft, { elements, effects, policy })
    setReport(next)
    return next
  }, [draft, elements, effects, policy])

  const clear = useCallback(() => setReport(null), [])

  const jumpTo = useCallback(
    (issue: ReportIssue) => {
      const { slideId, elementId } = issue.location
      if (slideId === undefined) return
      goToSlide(slideId)
      /**
       * An issue with no element selects **nothing** rather than the slide's first element.
       * Selecting something to have something selected points a teacher at the wrong element,
       * confidently — and a confident wrong answer costs more than an empty selection.
       */
      select(elementId === undefined ? [] : [elementId])
    },
    [goToSlide, select],
  )

  return { report, run, clear, jumpTo }
}
