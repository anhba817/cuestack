import type { ReactNode } from 'react'
import type { ReportIssue, ValidationReport as Report } from '@cuestack/core'

/**
 * The report a teacher reads, which is a different artefact from the one the engine returns.
 *
 * **Errors and warnings are separated**, because the first group is what stands between them and
 * publishing and the second is advice. A single list sorted by severity leaves that distinction to
 * be inferred from a colour.
 *
 * **Severity is a word** (NFR-ACC-003, Constitution III). Colour carries it as well, never alone:
 * the heading names the group, and each row states its severity in text.
 *
 * **A clean lesson is a sentence, not an empty region** (FR-011). "No issues found" is an answer;
 * a blank panel is indistinguishable from one that never ran.
 */
export interface ValidationReportProps {
  /** Null before the teacher has asked. Rendered as an invitation rather than as a result. */
  readonly report: Report | null
  readonly onSelect?: (issue: ReportIssue) => void
}

function Group({
  title,
  severity,
  issues,
  onSelect,
}: {
  title: string
  severity: string
  issues: readonly ReportIssue[]
  onSelect?: (issue: ReportIssue) => void
}): ReactNode {
  if (issues.length === 0) return null
  return (
    <section className="cs-report-group" data-cs-report-group={severity}>
      <h3>
        {title} ({issues.length})
      </h3>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${index}`} className="cs-report-issue">
            <button
              type="button"
              data-cs-report-issue={issue.code}
              onClick={onSelect ? () => onSelect(issue) : undefined}
              disabled={issue.location.slideId === undefined}
            >
              <span className="cs-report-severity">{severity}</span>
              <span className="cs-report-message">{issue.message}</span>
              <span className="cs-report-where">{where(issue)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Named in the teacher's terms — a slide and an element, never a JSON path. */
function where(issue: ReportIssue): string {
  const { slideId, elementId } = issue.location
  if (slideId === undefined) return 'This lesson'
  return elementId === undefined ? `Slide ${slideId}` : `Slide ${slideId}, element ${elementId}`
}

export function ValidationReport({ report, onSelect }: ValidationReportProps): ReactNode {
  return (
    <div className="cs-report" aria-label="Validation report">
      {report === null ? (
        <p className="cs-report-empty">This lesson has not been checked yet.</p>
      ) : report.issues.length === 0 ? (
        <p className="cs-report-empty">No issues found. This lesson is ready to publish.</p>
      ) : (
        <>
          <Group
            title="Errors"
            severity="error"
            issues={report.issues.filter((i) => i.severity === 'error')}
            onSelect={onSelect}
          />
          <Group
            title="Warnings"
            severity="warning"
            issues={report.issues.filter((i) => i.severity === 'warning')}
            onSelect={onSelect}
          />
        </>
      )}
    </div>
  )
}
