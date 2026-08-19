import { act } from 'react'
import { cleanup, render, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useValidation } from '../../src/validation/useValidation.js'
import { ValidationReport } from '../../src/validation/ValidationReport.js'
import { lessonWith, element } from '../harness/corpus.js'
import type { ReportIssue } from '@cuestack/core'

afterEach(cleanup)

const issue = (over: Partial<ReportIssue> = {}): ReportIssue => ({
  source: 'semantic',
  code: 'QUESTION_DEAD_END',
  severity: 'error',
  message: 'Stuck.',
  path: ['slides', 0],
  location: { slideId: 'slide_1', elementId: 'q1' },
  ...over,
})

function mount() {
  const goToSlide = vi.fn()
  const select = vi.fn()
  const view = renderHook(() =>
    useValidation({ draft: lessonWith([element({ id: 'a', effects: [] })]), goToSlide, select }),
  )
  return { goToSlide, select, view }
}

describe('jump to source (FR-005)', () => {
  it('navigates to the slide and selects the element', () => {
    const { goToSlide, select, view } = mount()
    act(() => view.result.current.jumpTo(issue()))

    expect(goToSlide).toHaveBeenCalledWith('slide_1')
    expect(select).toHaveBeenCalledWith(['q1'])
  })

  it('selects nothing when the issue has no element', () => {
    /**
     * A slide's advance rule belongs to the slide. Selecting its first element to have something
     * selected would point a teacher at an element that is not the problem, confidently.
     */
    const { goToSlide, select, view } = mount()
    act(() =>
      view.result.current.jumpTo(
        issue({ code: 'ADVANCE_UNSATISFIABLE', location: { slideId: 'slide_1' } }),
      ),
    )

    expect(goToSlide).toHaveBeenCalledWith('slide_1')
    expect(select).toHaveBeenCalledWith([])
  })

  it('does nothing at all for an issue that names no slide', () => {
    const { goToSlide, select, view } = mount()
    act(() => view.result.current.jumpTo(issue({ location: {} })))

    expect(goToSlide).not.toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()
  })

  it('runs on request, and holds the report until asked again', () => {
    const { view } = mount()
    expect(view.result.current.report).toBeNull()

    let produced: unknown
    act(() => {
      produced = view.result.current.run()
    })
    expect(view.result.current.report).toEqual(produced)

    act(() => view.result.current.clear())
    expect(view.result.current.report).toBeNull()
  })

  it('is wired through the panel a teacher clicks', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <ValidationReport report={{ issues: [issue()], blocks: true }} onSelect={onSelect} />,
    )
    const button = container.querySelector<HTMLButtonElement>('[data-cs-report-issue]')!
    act(() => button.click())

    expect(onSelect).toHaveBeenCalledWith(issue())
  })

  it('offers no destination for an issue that has none', () => {
    const { container } = render(
      <ValidationReport report={{ issues: [issue({ location: {} })], blocks: true }} onSelect={vi.fn()} />,
    )
    expect(container.querySelector<HTMLButtonElement>('[data-cs-report-issue]')!.disabled).toBe(true)
  })
})
