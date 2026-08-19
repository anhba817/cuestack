import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SaveStatus } from '../../src/persistence/SaveStatus.js'
import { ConflictNotice } from '../../src/persistence/ConflictNotice.js'
import { VersionHistory } from '../../src/persistence/VersionHistory.js'
import { RecoveryPrompt } from '../../src/persistence/RecoveryPrompt.js'
import type { VersionEntry } from '@cuestack/core'

/**
 * Everything feature 008 adds, reachable and operable from the keyboard alone (SC-011).
 *
 * These surfaces appear at the moments a teacher is least able to hunt for a control: a save
 * that failed, work recovered from an interruption, somebody else's version arriving on top of
 * theirs. A control that needs a mouse at one of those moments is a control that is not there.
 *
 * The recovery prompt is the one with a rule of its own — it is a modal `<dialog>`, so focus
 * containment and Escape come from the platform, and Escape deliberately does **not** dismiss
 * it: either answer is a decision, and there is no lesson to show until one is made.
 */
afterEach(cleanup)

const entry = (n: number): VersionEntry => ({
  token: `v${n}`,
  versionNumber: n,
  recordedAt: 1_700_000_000_000 + n * 60_000,
})

describe('the save status', () => {
  it('offers its retry as a real button', () => {
    const onRetry = vi.fn()
    const { container } = render(
      <SaveStatus state={{ kind: 'failed', attemptsSpent: true }} onRetry={onRetry} />,
    )
    const button = within(container).getByRole('button', { name: /try saving again/i })
    button.focus()
    expect(document.activeElement).toBe(button)
    button.click()
    expect(onRetry).toHaveBeenCalled()
  })
})

describe('the conflict notice', () => {
  it('offers both ways forward as focusable controls', () => {
    const onTakeStored = vi.fn()
    const onKeepMine = vi.fn()
    const { container } = render(
      <ConflictNotice
        conflict={{ lessonId: 'lesson', currentToken: 'v2' }}
        onTakeStored={onTakeStored}
        onKeepMine={onKeepMine}
      />,
    )
    const buttons = within(container).getAllByRole('button')
    expect(buttons).toHaveLength(2)
    for (const button of buttons) {
      button.focus()
      expect(document.activeElement).toBe(button)
    }
    buttons[0]!.click()
    buttons[1]!.click()
    expect(onKeepMine).toHaveBeenCalled()
    expect(onTakeStored).toHaveBeenCalled()
  })

  it('does not trap focus, because it does not block the work behind it', () => {
    // The opposite requirement to the recovery prompt's, and deliberately so: a teacher must
    // be able to leave this standing and carry on editing (FR-032a).
    const { container } = render(
      <ConflictNotice
        conflict={{ lessonId: 'lesson', currentToken: 'v2' }}
        onTakeStored={() => {}}
        onKeepMine={() => {}}
      />,
    )
    expect(container.querySelector('dialog')).toBeNull()
  })
})

describe('the version history', () => {
  it('lets a teacher move through the checkpoints and restore one', () => {
    const onRestore = vi.fn()
    const { container } = render(
      <VersionHistory versions={[entry(3), entry(2), entry(1)]} unavailable={false} onRestore={onRestore} />,
    )
    const buttons = within(container).getAllByRole('button')
    expect(buttons).toHaveLength(3)
    buttons[2]!.focus()
    expect(document.activeElement).toBe(buttons[2])
    buttons[2]!.click()
    expect(onRestore).toHaveBeenCalledWith('v1')
  })

  it('names each control by the version it restores, not just "Restore"', () => {
    // Three buttons all called "Restore" is a list a screen-reader user cannot navigate: the
    // name has to carry which one it is (NFR-ACC-003).
    const { container } = render(
      <VersionHistory versions={[entry(2), entry(1)]} unavailable={false} onRestore={() => {}} />,
    )
    const names = within(container)
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('the recovery prompt', () => {
  it('starts with focus inside it', () => {
    const { container } = render(
      <RecoveryPrompt movedOn={false} onRestore={() => {}} onDiscard={() => {}} />,
    )
    expect(container.querySelector('[data-cs-recovery-restore]')).not.toBeNull()
    expect(document.activeElement).toBe(container.querySelector('[data-cs-recovery-restore]'))
  })

  it('offers both answers as focusable controls', () => {
    const onRestore = vi.fn()
    const onDiscard = vi.fn()
    const { container } = render(
      <RecoveryPrompt movedOn={false} onRestore={onRestore} onDiscard={onDiscard} />,
    )
    within(container).getByRole('button', { name: /restore my work/i }).click()
    within(container).getByRole('button', { name: /discard it/i }).click()
    expect(onRestore).toHaveBeenCalled()
    expect(onDiscard).toHaveBeenCalled()
  })

  it('says when the lesson has changed underneath, so the choice is informed (FR-027b)', () => {
    const moved = render(<RecoveryPrompt movedOn onRestore={() => {}} onDiscard={() => {}} />)
    expect(moved.container.textContent).toMatch(/saved by someone else/i)
    cleanup()
    const plain = render(<RecoveryPrompt movedOn={false} onRestore={() => {}} onDiscard={() => {}} />)
    expect(plain.container.textContent).not.toMatch(/saved by someone else/i)
  })
})
