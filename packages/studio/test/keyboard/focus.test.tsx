import { act, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderEditor } from '../harness/editor.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * T093, T094 — FR-037, FR-038, FR-039.
 *
 * Focus is the only affordance a keyboard user has. The three claims here are that it is
 * visible, that the confirmation takes it, and that it comes back — the last being the one
 * that is invisible in a screenshot and obvious the moment it is missing.
 */
function setup(elements = [element(), element()]) {
  const { handle, container } = renderEditor(lessonWith(elements))
  return { session: handle, container }
}

describe('the authoring-time scrub (FR-037)', () => {
  it('is a real control, so the browser makes it keyboard-operable', () => {
    const { container } = setup()
    const scrub = container.querySelector<HTMLInputElement>('.cs-time-scrub')!
    expect(scrub.tagName).toBe('INPUT')
    expect(scrub.type).toBe('range')
    expect(scrub.disabled).toBe(false)
  })

  it('is labelled, so it is announced with a subject rather than a bare number', () => {
    const { container } = setup()
    const scrub = container.querySelector<HTMLInputElement>('.cs-time-scrub')!
    const label = container.querySelector(`label[for="${scrub.id}"]`)

    expect(label).not.toBeNull()
    expect(label!.textContent).toContain('Authoring time')
  })

  it('conveys its current value with units, not just a position', () => {
    const { container } = setup()
    const scrub = container.querySelector<HTMLInputElement>('.cs-time-scrub')!
    // Feature 004 found the player's progress bar announcing a position with no subject.
    // This is the same mistake, refused in the same way.
    expect(scrub.getAttribute('aria-valuetext')).toMatch(/seconds/)
  })

  it('changes the authoring time when operated', () => {
    const { session, container } = setup()
    const scrub = container.querySelector<HTMLInputElement>('.cs-time-scrub')!

    act(() => void fireEvent.change(scrub, { target: { value: '2500' } }))

    expect(session.session.authoringTime).toBe(2500)
  })

  it('spans the slide’s duration', () => {
    const { session, container } = setup()
    const scrub = container.querySelector<HTMLInputElement>('.cs-time-scrub')!
    expect(Number(scrub.max)).toBe(session.session.draft.slides[0]!.durationMs)
    expect(Number(scrub.min)).toBe(0)
  })
})

describe('the delete confirmation (FR-039)', () => {
  const open = () => {
    const fixture = setup([element()])
    act(() => fixture.session.session.select([fixture.session.session.draft.slides[0]!.elements[0]!.id]))
    act(() => void fireEvent.click(fixture.container.querySelector('[data-cs-delete]')!))
    return fixture
  }

  it('takes focus when it opens', () => {
    const { container } = open()
    expect(document.activeElement).toBe(container.querySelector('[data-cs-confirm-delete]'))
  })

  it('is dismissible by keyboard', () => {
    const { session, container } = open()
    act(() =>
      void fireEvent.keyDown(container.querySelector('[data-cs-confirm="delete"]')!, { key: 'Escape' }),
    )
    expect(container.querySelector('[data-cs-confirm="delete"]')).toBeNull()
    expect(session.session.draft.slides[0]!.elements).toHaveLength(1)
  })

  it('returns focus when it closes, rather than dropping it to the document', () => {
    const { container } = open()
    act(() => void fireEvent.click(container.querySelector('[data-cs-confirm-cancel]')!))

    // Somewhere in the editor, not on <body> — which is where focus goes when nobody
    // restores it, and where a keyboard user has to start again from the top.
    expect(document.activeElement).not.toBe(document.body)
  })
})

describe('every interactive affordance is reachable and named (FR-038)', () => {
  it('gives every overlay control an accessible name', () => {
    const { container } = setup()
    const controls = container.querySelectorAll('[data-cs-overlay] button, [data-cs-overlay] input')

    expect(controls.length).toBeGreaterThan(0)
    for (const control of controls) {
      const name =
        control.getAttribute('aria-label') ??
        control.textContent ??
        control.getAttribute('aria-labelledby')
      expect(name?.trim().length ?? 0).toBeGreaterThan(0)
    }
  })

  it('uses real buttons, so focus and activation come from the platform', () => {
    const { container } = setup()
    for (const hit of container.querySelectorAll('[data-cs-hit]')) {
      expect(hit.tagName).toBe('BUTTON')
    }
  })

  it('reports selection state on the hit targets', () => {
    const { session, container } = setup()
    const id = session.session.draft.slides[0]!.elements[0]!.id
    act(() => session.session.select([id]))

    const hit = container.querySelector(`[data-cs-hit][data-cs-element-id="${id}"]`)!
    expect(hit.getAttribute('aria-pressed')).toBe('true')
  })
})
