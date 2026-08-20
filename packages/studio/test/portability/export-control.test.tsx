import { act } from 'react'
import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PortabilityControls } from '../../src/portability/PortabilityControls.js'
import { lessonWith, element } from '../harness/corpus.js'
import type { LessonPackage } from '@cuestack/core'

afterEach(cleanup)

/** One lesson, reused — `lessonWith` builds a fresh object each call and identity matters here. */
const DRAFT = lessonWith([element({ id: 'a', effects: [] })])
const draft = () => DRAFT

/** A click that lets React commit the state it caused, which is what makes the status observable. */
const press = (node: HTMLElement): void => {
  act(() => node.click())
}

describe('the export control', () => {
  it('produces a document and hands it to its callback', () => {
    const onExported = vi.fn()
    const { container } = render(<PortabilityControls draft={draft()} onExported={onExported} />)

    press(within(container).getByRole('button', { name: /export/i }))

    expect(onExported).toHaveBeenCalledTimes(1)
    const [pkg] = onExported.mock.calls[0] as [LessonPackage]
    expect(pkg.kind).toBe('draft')
    expect(pkg.lesson).toEqual(draft())
    expect(pkg.packageVersion).toBeTruthy()
  })

  it('reads no file and writes none', () => {
    /**
     * `packages/studio/src` may not read files any more than it may read a clock. Where a package
     * is written is the host's choice, so the control hands a value to a callback and stops — the
     * split research R-09 exists for.
     */
    const { container } = render(<PortabilityControls draft={draft()} onExported={vi.fn()} />)
    expect(container.querySelector('input[type="file"]')).toBeNull()
    expect(container.querySelector('a[download]')).toBeNull()
  })

  it('is operable from the keyboard with an accessible name', () => {
    const onExported = vi.fn()
    const { container } = render(<PortabilityControls draft={draft()} onExported={onExported} />)
    const button = within(container).getByRole('button', { name: /export/i })

    button.focus()
    expect(document.activeElement).toBe(button)
    press(button)
    expect(onExported).toHaveBeenCalled()
  })

  it('states what happened in words rather than by colour', () => {
    const { container } = render(<PortabilityControls draft={draft()} onExported={vi.fn()} />)
    press(within(container).getByRole('button', { name: /export/i }))

    const status = container.querySelector('.cs-portability-status')!
    expect(status.textContent).toMatch(/exported/i)
    // NFR-ACC-003: the word is the state. Colour may reinforce it and may not carry it.
    expect(status.getAttribute('role')).toBe('status')
  })

  it('offers a published export only when the host supplies one', () => {
    /**
     * FR-004d. The framework supports both kinds; which surfaces offer which is the host's. A
     * control that showed the option with nothing behind it would be the declared-with-no-producer
     * pattern in a button.
     */
    const { container, rerender } = render(<PortabilityControls draft={draft()} onExported={vi.fn()} />)
    expect(container.querySelector('[data-cs-export-published]')).toBeNull()

    rerender(
      <PortabilityControls draft={draft()} onExported={vi.fn()} published={draft()} />,
    )
    expect(container.querySelector('[data-cs-export-published]')).toBeTruthy()
  })

  it('marks a published export as published', () => {
    const onExported = vi.fn()
    const { container } = render(
      <PortabilityControls draft={draft()} onExported={onExported} published={draft()} />,
    )
    press(container.querySelector<HTMLButtonElement>('[data-cs-export-published]')!)

    const [pkg] = onExported.mock.calls[0] as [LessonPackage]
    expect(pkg.kind).toBe('published')
  })
})
