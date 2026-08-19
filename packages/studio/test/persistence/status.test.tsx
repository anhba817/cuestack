import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SaveStatus } from '../../src/persistence/SaveStatus.js'
import type { SaveState, SaveStateKind } from '../../src/persistence/useDraftPersistence.js'

/**
 * Four words, one at a time, and never none.
 *
 * Constitution III fixes the vocabulary and requires *one* component across saving and
 * publishing — so the assertions below are about the component's contract rather than about
 * the editor: it takes a status, it renders exactly one of the four, and nothing in it assumes
 * the status describes a draft.
 *
 * The "never none" case is the one worth keeping. An earlier draft of the data model rendered
 * `idle` as nothing, which would have made FR-016's "exactly one of" false on open and again
 * after every acknowledgement.
 */
afterEach(cleanup)

const WORDS = ['Saving', 'Saved', 'Offline', 'Save Failed']
const ALL: SaveStateKind[] = ['idle', 'pending', 'saving', 'saved', 'offline', 'failed']

const wordsIn = (container: HTMLElement): string[] => {
  const text = container.querySelector('.cs-save-status-word')?.textContent ?? ''
  return WORDS.filter((w) => text === w)
}

describe('the status renders exactly one of four words', () => {
  for (const kind of ALL) {
    it(`says one thing for "${kind}"`, () => {
      const { container } = render(<SaveStatus state={{ kind }} />)
      expect(wordsIn(container)).toHaveLength(1)
    })
  }

  it('never renders nothing', () => {
    for (const kind of ALL) {
      const { container } = render(<SaveStatus state={{ kind }} />)
      expect(container.querySelector('.cs-save-status-word')?.textContent).toBeTruthy()
      cleanup()
    }
  })

  it('reads Saved when nothing is outstanding, on open as after a write', () => {
    const { container } = render(<SaveStatus state={{ kind: 'idle' }} />)
    expect(container.querySelector('.cs-save-status-word')?.textContent).toBe('Saved')
  })

  it('reads Saving both while waiting and while in flight', () => {
    const pending = render(<SaveStatus state={{ kind: 'pending' }} />)
    expect(pending.container.querySelector('.cs-save-status-word')?.textContent).toBe('Saving')
    cleanup()
    const saving = render(<SaveStatus state={{ kind: 'saving' }} />)
    expect(saving.container.querySelector('.cs-save-status-word')?.textContent).toBe('Saving')
  })

  it('invents no fifth word for a conflict — it is a Save Failed', () => {
    const { container } = render(
      <SaveStatus state={{ kind: 'failed', message: 'A newer version exists.' }} />,
    )
    expect(container.querySelector('.cs-save-status-word')?.textContent).toBe('Save Failed')
  })
})

describe('what it says beyond the word', () => {
  it('carries the reason as prose, so the state is not colour alone', () => {
    const state: SaveState = { kind: 'offline', message: 'Your work is safe here.' }
    const { container } = render(<SaveStatus state={state} />)
    expect(container.textContent).toContain('Your work is safe here.')
  })

  it('offers a retry only once the automatic attempts are spent', () => {
    const offered = render(<SaveStatus state={{ kind: 'failed', attemptsSpent: true }} onRetry={() => {}} />)
    expect(offered.container.querySelector('[data-cs-save-retry]')).not.toBeNull()
    cleanup()
    const trying = render(<SaveStatus state={{ kind: 'offline' }} onRetry={() => {}} />)
    expect(trying.container.querySelector('[data-cs-save-retry]')).toBeNull()
  })

  it('calls back when the teacher asks to try again', () => {
    const onRetry = vi.fn()
    const { container } = render(
      <SaveStatus state={{ kind: 'failed', attemptsSpent: true }} onRetry={onRetry} />,
    )
    within(container).getByRole('button', { name: /try saving again/i }).click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('announces changes politely rather than interrupting', () => {
    const { container } = render(<SaveStatus state={{ kind: 'saved' }} />)
    const node = container.querySelector('.cs-save-status')!
    expect(node.getAttribute('role')).toBe('status')
    expect(node.getAttribute('aria-live')).toBe('polite')
  })
})

describe('it is not a draft-save component', () => {
  it('takes a status and nothing else, so publishing can render through it (PB-2)', () => {
    // The structural half of Constitution III's "one shared component": nothing in the props
    // names a draft, a lesson, or a save. A publish state is the same seven kinds.
    const { container } = render(<SaveStatus state={{ kind: 'saving' }} />)
    expect(container.querySelector('.cs-save-status-word')?.textContent).toBe('Saving')
  })
})
