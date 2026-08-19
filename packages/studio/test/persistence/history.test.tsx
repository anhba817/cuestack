import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VersionHistory } from '../../src/persistence/VersionHistory.js'
import type { VersionEntry } from '@cuestack/core'

/**
 * The version-history surface: checkpoints, newest first, with restore where it is allowed.
 *
 * Two things here are easy to get wrong in ways that only bite later. An unreachable history
 * must not render as an empty one — "no earlier versions" is a lie a teacher acts on, and the
 * action is to stop looking. And in read-only the restore control must be **absent**, not
 * present-and-refusing: the `replace-draft` refusal is the backstop, not the interface
 * (FR-039b, FR-043).
 *
 * The rendered date is deliberately not asserted as a string. `Intl.DateTimeFormat` with no
 * locale follows the runtime's, so an assertion on "14 Nov 2023, 09:00" passes on one machine
 * and fails on another.
 */
afterEach(cleanup)

const entry = (n: number, label?: string): VersionEntry => ({
  token: `v${n}`,
  versionNumber: n,
  recordedAt: 1_700_000_000_000 + n * 60_000,
  ...(label !== undefined ? { label } : {}),
})

describe('listing the checkpoints', () => {
  it('renders one row per entry, in the order given', () => {
    const { container } = render(
      <VersionHistory versions={[entry(3), entry(2), entry(1)]} unavailable={false} />,
    )
    const rows = [...container.querySelectorAll('[data-cs-version]')].map((n) =>
      n.getAttribute('data-cs-version'),
    )
    expect(rows).toEqual(['v3', 'v2', 'v1'])
  })

  it('shows when each was recorded', () => {
    const { container } = render(<VersionHistory versions={[entry(1)]} unavailable={false} />)
    expect(container.querySelector('.cs-version-when')?.textContent).toBeTruthy()
  })

  it('shows a name where the teacher gave one, and nothing where they did not', () => {
    const named = render(<VersionHistory versions={[entry(1, 'Before the rewrite')]} unavailable={false} />)
    expect(named.container.textContent).toContain('Before the rewrite')
    cleanup()
    const plain = render(<VersionHistory versions={[entry(1)]} unavailable={false} />)
    expect(plain.container.querySelector('.cs-version-label')).toBeNull()
  })

  it('says plainly when there are none yet', () => {
    const { container } = render(<VersionHistory versions={[]} unavailable={false} />)
    expect(container.textContent).toMatch(/no earlier versions yet/i)
  })
})

describe('when the history cannot be reached', () => {
  it('says so rather than showing an empty list (FR-043)', () => {
    const { container } = render(<VersionHistory versions={[]} unavailable />)
    expect(container.textContent).toMatch(/cannot be reached/i)
    expect(container.textContent).toMatch(/have not been lost/i)
    expect(container.querySelector('.cs-versions-list')).toBeNull()
  })
})

describe('restoring', () => {
  it('offers a control that names which version it restores', () => {
    const onRestore = vi.fn()
    const { container } = render(
      <VersionHistory versions={[entry(1)]} unavailable={false} onRestore={onRestore} />,
    )
    const button = within(container).getByRole('button', { name: /restore the version from/i })
    button.click()
    expect(onRestore).toHaveBeenCalledWith('v1')
  })

  it('is not offered at all in read-only (FR-039b)', () => {
    // The backstop refuses; the interface should not have asked. A control that looks
    // operable and then refuses is the failure NFR-USA-004 describes.
    const { container } = render(<VersionHistory versions={[entry(1)]} unavailable={false} />)
    expect(container.querySelector('[data-cs-version-restore]')).toBeNull()
    // And the history is still readable, which is the other half of FR-039b.
    expect(container.querySelectorAll('[data-cs-version]')).toHaveLength(1)
  })
})
