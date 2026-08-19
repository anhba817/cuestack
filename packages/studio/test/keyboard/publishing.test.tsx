import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublishControls } from '../../src/publishing/PublishControls.js'
import { ValidationReport } from '../../src/validation/ValidationReport.js'
import type { Publishing } from '../../src/publishing/usePublishing.js'
import { VersionList } from '../../src/publishing/VersionList.js'
import { PublicationRecord } from '../../src/publishing/PublicationRecord.js'
import type { PublishedVersion, ReportIssue } from '@cuestack/core'

afterEach(cleanup)

/**
 * Publishing and its report, operable from the keyboard alone (SC-011).
 *
 * Both surfaces exist at a moment a teacher is deciding something — whether a lesson is ready, and
 * what to fix first. A jump-to-source that only a mouse can reach turns the report into a list to
 * read and copy from rather than a set of destinations.
 */
const publishing = (over: Partial<Publishing> = {}): Publishing => ({
  outcome: null,
  busy: false,
  report: null,
  publish: vi.fn(async () => ({ ok: true }) as never),
  withdraw: vi.fn(async () => ({ ok: true })),
  restore: vi.fn(async () => ({ ok: true })),
  ...over,
})

describe('the publish controls', () => {
  it('offers publish as a focusable button that acts', () => {
    const hook = publishing()
    const { container } = render(<PublishControls publishing={hook} />)
    const button = within(container).getByRole('button', { name: /^publish$/i })

    button.focus()
    expect(document.activeElement).toBe(button)
    button.click()
    expect(hook.publish).toHaveBeenCalled()
  })

  it('offers withdrawal only when there is something active to withdraw', () => {
    const hook = publishing()
    const { container, rerender } = render(<PublishControls publishing={hook} />)
    expect(container.querySelector('[data-cs-withdraw]')).toBeNull()

    rerender(<PublishControls publishing={hook} active />)
    const button = within(container).getByRole('button', { name: /withdraw/i })
    button.focus()
    expect(document.activeElement).toBe(button)
    button.click()
    expect(hook.withdraw).toHaveBeenCalled()
  })

  it('disables its controls while a publish is in flight rather than removing them', () => {
    /**
     * Removing them would move focus to `<body>` mid-action — the failure feature 008 met when a
     * confirmation disappeared — and a teacher who pressed Publish would lose their place.
     */
    const { container } = render(<PublishControls publishing={publishing({ busy: true })} active />)
    const buttons = [...container.querySelectorAll('button')]
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.every((b) => b.disabled)).toBe(true)
  })
})

describe('the report', () => {
  const issue = (over: Partial<ReportIssue> = {}): ReportIssue => ({
    source: 'semantic',
    code: 'QUESTION_DEAD_END',
    severity: 'error',
    message: 'A learner who runs out of attempts is stuck here.',
    path: [],
    location: { slideId: 'slide_0', elementId: 'q1' },
    ...over,
  })

  it('makes every issue a focusable destination', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <ValidationReport
        report={{
          issues: [issue(), issue({ code: 'ELEMENT_BEYOND_SLIDE', severity: 'warning' })],
          blocks: true,
        }}
        onSelect={onSelect}
      />,
    )

    const buttons = [...container.querySelectorAll<HTMLButtonElement>('[data-cs-report-issue]')]
    expect(buttons).toHaveLength(2)
    for (const button of buttons) {
      button.focus()
      expect(document.activeElement).toBe(button)
    }
    buttons[1]!.click()
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('does not offer a destination that does not exist', () => {
    const { container } = render(
      <ValidationReport report={{ issues: [issue({ location: {} })], blocks: true }} onSelect={vi.fn()} />,
    )
    expect(container.querySelector<HTMLButtonElement>('[data-cs-report-issue]')!.disabled).toBe(true)
  })
})

describe('the published version list', () => {
  const version = (n: number): PublishedVersion => ({
    id: `pv_${n}`,
    manifest: { schemaVersion: '1.0' } as never,
    versionNumber: n,
    publishedBy: 'ms-okafor',
    publishedAt: 1_700_000_000_000 + n * 60_000,
    schemaVersion: '1.0',
  })

  it('is readable without being operable, because there is nothing to operate', () => {
    /**
     * Deliberately no controls. A published version has no edit path (BR-008), and "restore this
     * version" belongs to ED-5's draft checkpoints — offering it here would invite a teacher to
     * treat what learners received as working state. So the keyboard requirement this list carries
     * is that its content is reachable as text, not that it holds focusable controls.
     */
    const { container } = render(<VersionList versions={[version(2), version(1)]} activeId="pv_2" />)
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe('Published versions')
    expect(container.textContent).toContain('Version 2')
    expect(container.textContent).toContain('ms-okafor')
  })

  it('says a lesson has not been published rather than showing nothing', () => {
    const { container } = render(<VersionList versions={[]} />)
    expect(container.textContent).toContain('not been published')
  })
})

describe('the publication record', () => {
  it('reads as a sequence, oldest first', () => {
    const { container } = render(
      <PublicationRecord
        entries={[
          { action: 'published', versionId: 'pv_1', actor: 'ms-okafor', at: 1_700_000_000_000 },
          { action: 'withdrawn', versionId: 'pv_1', actor: 'mr-adeyemi', at: 1_700_000_060_000 },
          { action: 'restored', versionId: 'pv_1', actor: 'ms-okafor', at: 1_700_000_120_000 },
        ]}
      />,
    )
    const words = [...container.querySelectorAll('.cs-record-what')].map((n) => n.textContent)
    expect(words).toEqual(['Published', 'Withdrawn', 'Restored'])
  })

  it('offers nothing to press, because nothing can change an entry', () => {
    const { container } = render(
      <PublicationRecord
        entries={[{ action: 'published', versionId: 'pv_1', actor: 'a', at: 1_700_000_000_000 }]}
      />,
    )
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe('Publication record')
  })
})
