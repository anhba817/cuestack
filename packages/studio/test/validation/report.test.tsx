import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ValidationReport } from '../../src/validation/ValidationReport.js'
import type { ReportIssue, ValidationReport as Report } from '@cuestack/core'

afterEach(cleanup)

const issue = (over: Partial<ReportIssue> = {}): ReportIssue => ({
  source: 'semantic',
  code: 'QUESTION_DEAD_END',
  severity: 'error',
  message: 'A learner who runs out of attempts is stuck here.',
  path: ['slides', 0],
  location: { slideId: 'slide_0', elementId: 'q1' },
  ...over,
})

const report = (issues: ReportIssue[]): Report => ({
  issues,
  blocks: issues.some((i) => i.severity === 'error'),
})

describe('the report a teacher reads', () => {
  it('groups errors and warnings under their own headings', () => {
    render(
      <ValidationReport
        report={report([
          issue(),
          issue({ code: 'ACCESSIBILITY_METADATA_ABSENT', severity: 'warning', message: 'No alt text.' }),
        ])}
      />,
    )

    expect(screen.getByRole('heading', { name: /errors \(1\)/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /warnings \(1\)/i })).toBeTruthy()
  })

  it('states severity as a word, not only as a colour', () => {
    const { container } = render(<ValidationReport report={report([issue()])} />)
    const words = [...container.querySelectorAll('.cs-report-severity')].map((n) => n.textContent)
    expect(words).toEqual(['error'])
  })

  it('names the slide and element in a teacher\'s terms', () => {
    render(<ValidationReport report={report([issue()])} />)
    expect(screen.getByText('Slide slide_0, element q1')).toBeTruthy()
  })

  it('says a clean lesson is clean, rather than showing an empty region', () => {
    render(<ValidationReport report={report([])} />)
    expect(screen.getByText(/no issues found/i)).toBeTruthy()
  })

  it('distinguishes "not checked yet" from "nothing wrong"', () => {
    render(<ValidationReport report={null} />)
    expect(screen.getByText(/has not been checked yet/i)).toBeTruthy()
    expect(screen.queryByText(/no issues found/i)).toBeNull()
  })

  it('omits a group entirely rather than showing an empty one', () => {
    const { container } = render(
      <ValidationReport
        report={report([issue({ severity: 'warning', code: 'ELEMENT_BEYOND_SLIDE' })])}
      />,
    )
    expect(container.querySelector('[data-cs-report-group="error"]')).toBeNull()
    expect(container.querySelector('[data-cs-report-group="warning"]')).toBeTruthy()
  })
})
