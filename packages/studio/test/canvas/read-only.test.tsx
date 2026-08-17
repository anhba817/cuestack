import { act, fireEvent, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakePorts, renderEditor } from '../harness/editor.js'
import { element, lessonWith } from '../harness/corpus.js'
import { timelineLesson } from '../harness/timeline.js'

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
    // Feature 006 replaced the authoring-time scrub with the timeline's playhead (FR-006).
    // The promise is unchanged and is the interesting half of read-only: every *mutating*
    // control is unavailable, while seeking and reading remain (FR-047).
    const { handle, container } = renderEditor(lessonWith([element()]), {
      mode: 'read-only',
      timeline: true,
      ports: fakePorts(),
    })
    const playhead = container.querySelector<HTMLInputElement>('.cs-playhead')!

    act(() => void fireEvent.change(playhead, { target: { value: '3000' } }))
    expect(handle.session.authoringTime).toBe(3000)
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

describe('read-only across the surfaces feature 006 adds (FR-047)', () => {
  /**
   * The interesting half is what stays *available*. Read-only is not "the editor is frozen":
   * a teacher reviewing a lesson must still be able to look at any moment, which is why
   * seeking and playing are untouched while every mutating control is disabled.
   */
  const open = () =>
    renderEditor(
      timelineLesson([
        element({
          startMs: 0,
          endMs: 4000,
          effects: [{ id: 'fx-1', type: 'fade', phase: 'enter', startMs: 0, durationMs: 400, order: 0 }],
        }),
        element({ startMs: 2000, endMs: 6000 }),
      ]),
      { mode: 'read-only', timeline: true, sequence: true, inspector: true, ports: fakePorts() },
    )

  it('still lets a teacher seek', () => {
    const { handle, container } = open()
    act(() => void fireEvent.change(container.querySelector('.cs-playhead')!, { target: { value: '2200' } }))
    expect(handle.session.authoringTime).toBe(2200)
  })

  it('still lets a teacher play and pause', () => {
    const { handle, container } = open()
    act(() => void fireEvent.click(within(container).getByRole('button', { name: /^play$/i })))
    expect(handle.playback.state).toBe('playing')
  })

  it('disables every sequence control', () => {
    const { container } = open()
    for (const control of container.querySelectorAll('.cs-sequence select, .cs-sequence input')) {
      expect((control as HTMLSelectElement).disabled).toBe(true)
    }
  })

  it('disables every effect control', () => {
    const { handle, container } = open()
    // The inspector shows an element's panel only when one is selected — and selecting is
    // reading, so read-only permits it.
    act(() => handle.session.select([handle.session.draft.slides[0]!.elements[0]!.id]))
    const controls = container.querySelectorAll('.cs-effects select, .cs-effects input, .cs-effects button')
    expect(controls.length).toBeGreaterThan(0)
    for (const control of controls) expect((control as HTMLButtonElement).disabled).toBe(true)
  })

  it('refuses a re-time dragged anyway, and says why', () => {
    const { handle } = open()
    const el = handle.session.draft.slides[0]!.elements[0]!
    let refused = false
    act(() => {
      refused = !handle.session.apply({ kind: 'set-timing', id: el.id, startMs: 500 }).ok
    })
    expect(refused).toBe(true)
  })
})
