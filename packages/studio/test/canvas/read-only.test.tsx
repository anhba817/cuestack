import { act, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderEditor } from '../harness/editor.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * T113 — FR-051, SC-017: read-only, in both halves.
 *
 * The reducer's refusal is the enforcement and it is invisible to the person it applies to. A
 * Reviewer who opens a lesson, presses Add, and sees nothing happen concludes the editor is
 * broken. The presentation half is what tells them it is deliberate — which is why FR-051 says
 * "unavailable **and states why**" rather than just refusing.
 */
function setup(mode: 'edit' | 'read-only') {
  const { handle, container } = renderEditor(lessonWith([element(), element()]), { mode })
  return { s: handle, container }
}

describe('read-only says so, and disables rather than hides', () => {
  it('states the mode in words', () => {
    const { container } = setup('read-only')
    const banner = container.querySelector('[data-cs-readonly]')

    expect(banner).not.toBeNull()
    expect(banner!.textContent).toContain('open for reading')
    // And says what is still possible, so the teacher is not left guessing.
    expect(banner!.textContent).toContain('copying is still permitted')
  })

  it('shows the controls disabled rather than removing them', () => {
    const { container } = setup('read-only')

    // Present, so a Reviewer can see what an Editor would be able to do.
    expect(container.querySelector('[data-cs-add-menu]')).not.toBeNull()
    expect(container.querySelector('[data-cs-manage]')).not.toBeNull()

    for (const selector of ['[data-cs-add="text"]', '[data-cs-delete]', '[data-cs-duplicate]']) {
      expect(container.querySelector<HTMLButtonElement>(selector)!.disabled).toBe(true)
    }
  })

  it('leaves copying available — it changes nothing', () => {
    const { s, container } = setup('read-only')
    act(() => s.session.select([s.session.draft.slides[0]!.elements[0]!.id]))

    const copy = container.querySelector<HTMLButtonElement>('[data-cs-copy]')!
    expect(copy.disabled).toBe(false)

    act(() => void fireEvent.click(copy))
    expect(s.session.clipboard).toHaveLength(1)
  })

  it('refuses pasting, even with something on the clipboard', () => {
    const { s, container } = setup('read-only')
    act(() => s.session.select([s.session.draft.slides[0]!.elements[0]!.id]))
    act(() => void fireEvent.click(container.querySelector<HTMLButtonElement>('[data-cs-copy]')!))

    act(() => void s.session.apply({ kind: 'paste', elements: s.session.clipboard }))

    expect(s.session.lastRefusal?.reason).toBe('read-only')
    expect(s.session.draft.slides[0]!.elements).toHaveLength(2)
  })

  it('still allows selecting and reading, which is the point of the mode', () => {
    const { s, container } = setup('read-only')
    const id = s.session.draft.slides[0]!.elements[0]!.id

    act(() => void fireEvent.pointerDown(container.querySelector(`[data-cs-hit][data-cs-element-id="${id}"]`)!))
    expect(s.session.selection).toEqual([id])
  })

  it('still allows moving the authoring time', () => {
    const { s, container } = setup('read-only')
    const scrub = container.querySelector<HTMLInputElement>('.cs-time-scrub')!

    act(() => void fireEvent.change(scrub, { target: { value: '3000' } }))
    expect(s.session.authoringTime).toBe(3000)
  })

  it('lets no edit through, across the whole action surface (SC-017)', () => {
    const { s, container } = setup('read-only')
    act(() => s.session.select(s.session.draft.slides[0]!.elements.map((e) => e.id)))
    const before = JSON.stringify(s.session.draft)

    const overlay = container.querySelector('[data-cs-overlay]')!
    for (const key of ['ArrowRight', 'Delete', 'Enter', 'Escape']) {
      act(() => void fireEvent.keyDown(overlay, { key }))
    }
    for (const key of ['d', 'v', 'c', 'a']) {
      act(() => void fireEvent.keyDown(overlay, { key, metaKey: true }))
    }

    expect(JSON.stringify(s.session.draft)).toBe(before)
  })

  it('says nothing about read-only when editing is allowed', () => {
    const { container } = setup('edit')
    expect(container.querySelector('[data-cs-readonly]')).toBeNull()
    expect(container.querySelector<HTMLButtonElement>('[data-cs-add="text"]')!.disabled).toBe(false)
  })
})
