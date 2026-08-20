import { act } from 'react'
import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PortabilityControls } from '../../src/portability/PortabilityControls.js'
import { lessonWith, element } from '../harness/corpus.js'

afterEach(cleanup)

const DRAFT = lessonWith([element({ id: 'a', effects: [] })])

/**
 * SC-012: both controls reachable and operable from the keyboard alone.
 *
 * These appear at a moment a teacher has decided to take their work somewhere else, or to bring
 * somebody else's in. A control that needs a mouse at that moment is a control that is not there —
 * and the outcome must be *announced*, because someone who pressed a button and looked away learns
 * nothing from a line that merely appears.
 */
describe('the portability controls', () => {
  it('offers every control as a focusable button that acts', () => {
    const onExported = vi.fn()
    const onImport = vi.fn(() => 'done')
    const { container } = render(
      <PortabilityControls
        draft={DRAFT}
        published={DRAFT}
        onExported={onExported}
        requestPackage={async () => null}
        onImport={onImport}
      />,
    )

    const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')]
    expect(buttons).toHaveLength(3)
    for (const button of buttons) {
      button.focus()
      expect(document.activeElement).toBe(button)
      expect(button.textContent?.trim().length ?? 0).toBeGreaterThan(0)
    }

    act(() => buttons[0]!.click())
    expect(onExported).toHaveBeenCalled()
  })

  it('names each control by what it does, not by an icon', () => {
    const { container } = render(
      <PortabilityControls draft={DRAFT} published={DRAFT} onExported={vi.fn()} />,
    )
    expect(within(container).getByRole('button', { name: /export this lesson/i })).toBeTruthy()
    expect(within(container).getByRole('button', { name: /export the published version/i })).toBeTruthy()
  })

  it('announces the outcome politely rather than interrupting', () => {
    const { container } = render(<PortabilityControls draft={DRAFT} onExported={vi.fn()} />)
    act(() => container.querySelector<HTMLButtonElement>('[data-cs-export-draft]')!.click())

    const status = container.querySelector('.cs-portability-status')!
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('role')).toBe('status')
  })

  it('keeps focus where it was after an action, rather than dropping it to the body', () => {
    /**
     * The failure feature 008 met when a confirmation disappeared mid-action. Nothing here is
     * removed on press, so focus stays on the control the teacher used.
     */
    const { container } = render(<PortabilityControls draft={DRAFT} onExported={vi.fn()} />)
    const button = container.querySelector<HTMLButtonElement>('[data-cs-export-draft]')!
    button.focus()
    act(() => button.click())
    expect(document.activeElement).toBe(button)
  })
})
