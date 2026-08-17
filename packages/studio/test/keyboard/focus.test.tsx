import { act, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { within } from '@testing-library/react'
import { fakePorts, renderEditor } from '../harness/editor.js'
import { element, lessonWith } from '../harness/corpus.js'
import { timelineLesson } from '../harness/timeline.js'

/**
 * T093, T094 — FR-037, FR-038, FR-039.
 *
 * Focus is the only affordance a keyboard user has. The three claims here are that it is
 * visible, that the confirmation takes it, and that it comes back — the last being the one
 * that is invisible in a screenshot and obvious the moment it is missing.
 */
/**
 * Queries scoped to the timeline.
 *
 * The canvas and the timeline both hold controls, and an unscoped `getByRole('slider')`
 * would have matched the old authoring-time scrub as well as the playhead — which is how
 * this file found that both existed at once.
 */
function withinTimeline(container: HTMLElement) {
  return within(container.querySelector('.cs-timeline') as HTMLElement)
}

function setup(elements = [element(), element()]) {
  const { handle, container } = renderEditor(lessonWith(elements))
  return { session: handle, container }
}

describe('the playhead (FR-008, FR-037 carried forward)', () => {
  /**
   * These five assertions were written against feature 005's authoring-time scrub, which
   * feature 006 deleted. They **migrated** rather than being removed: they are the
   * playhead's requirements restated, and the obligation feature 005 recorded was that its
   * scrub would be *replaced*, not that its promises would lapse.
   *
   * Two controls writing one authoring time is the parity hazard FR-006 closes. What
   * survives the replacement is that a teacher can still reach the moment by keyboard and
   * hear it announced with a subject.
   */
  const open = () => renderEditor(timelineLesson([element()]), { timeline: true, ports: fakePorts() })

  it('is a real control, so the browser makes it keyboard-operable', () => {
    const { container } = open()
    const playhead = withinTimeline(container).getByRole('slider', { name: /authoring time/i })
    expect(playhead.tagName).toBe('INPUT')
    expect(playhead.getAttribute('type')).toBe('range')
  })

  it('is labelled, so it is announced with a subject rather than a bare number', () => {
    const { container } = open()
    const playhead = withinTimeline(container).getByRole('slider', { name: /authoring time/i })
    expect(playhead.getAttribute('aria-label')).toMatch(/authoring time/i)
  })

  it('conveys its current value with units, not just a position', () => {
    const { container } = open()
    const playhead = withinTimeline(container).getByRole('slider', { name: /authoring time/i })
    expect(playhead.getAttribute('aria-valuetext')).toMatch(/second/i)
  })

  it('changes the authoring time when operated', () => {
    const { handle, container } = open()
    const playhead = withinTimeline(container).getByRole('slider', { name: /authoring time/i })
    act(() => {
      fireEvent.change(playhead, { target: { value: '2500' } })
    })
    expect(handle.session.authoringTime).toBe(2500)
  })

  it('spans the slide’s duration', () => {
    const { container } = open()
    const playhead = withinTimeline(container).getByRole('slider', { name: /authoring time/i })
    expect(playhead.getAttribute('min')).toBe('0')
    expect(playhead.getAttribute('max')).toBe('8000')
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

describe('the new surfaces show a visible focus indicator (FR-046)', () => {
  /**
   * axe cannot check this, which is why it needs its own assertions.
   *
   * A focus ring is what tells a keyboard user *where they are*; without one the editor is
   * navigable and unusable at the same time. The rule lives in `editor.css` as
   * `.cs-timeline :focus-visible`, so this asserts the controls are inside the scope that
   * rule covers rather than re-implementing a CSS engine happy-dom does not have.
   */
  /**
   * The name a screen reader would announce, in the order the platform resolves it.
   *
   * `??` is wrong here and was wrong at first: `input.textContent` is the empty *string*, not
   * nullish, so it short-circuits before the wrapping `<label>` is ever consulted — and every
   * labelled input looks unnamed. Falsy-checking each candidate is what this needs.
   */
  const accessibleName = (control: Element): string =>
    control.getAttribute('aria-label') ||
    control.textContent?.trim() ||
    control.closest('label')?.textContent?.trim() ||
    ''

  const openAll = () =>
    renderEditor(
      timelineLesson([
        element({
          startMs: 0,
          endMs: 4000,
          effects: [{ id: 'fx-1', type: 'fade', phase: 'enter', startMs: 0, durationMs: 400, order: 0 }],
        }),
        element({ startMs: 2000, endMs: 6000 }),
      ]),
      { timeline: true, sequence: true, inspector: true, ports: fakePorts() },
    )

  /** Two overlapping elements and nothing else, so exactly one row is Custom. */
  const openCustom = () =>
    renderEditor(
      timelineLesson([element({ startMs: 0, endMs: 4000 }), element({ startMs: 2000, endMs: 6000 })]),
      { sequence: true },
    )

  it('puts every timeline control inside the focus-ring scope', () => {
    const { container } = openAll()
    const timeline = container.querySelector('.cs-timeline')!
    for (const control of timeline.querySelectorAll('button, input, select')) {
      expect(timeline.contains(control)).toBe(true)
    }
    // And there are some — an empty sweep would pass vacuously.
    expect(timeline.querySelectorAll('button, input, select').length).toBeGreaterThan(3)
  })

  it('gives every timeline control an accessible name', () => {
    const { container } = openAll()
    for (const control of container.querySelectorAll('.cs-timeline button, .cs-timeline input')) {
      expect(accessibleName(control), control.outerHTML.slice(0, 80)).toBeTruthy()
    }
  })

  it('gives every sequence and effect control one too', () => {
    const { container } = openAll()
    for (const control of container.querySelectorAll('.cs-sequence select, .cs-effects select, .cs-effects button')) {
      expect(accessibleName(control), control.outerHTML.slice(0, 80)).toBeTruthy()
    }
  })

  it('takes focus and gives it back around the Custom confirmation', () => {
    const { container } = openCustom()
    const select = within(container.querySelector('.cs-sequence') as HTMLElement).getByLabelText('Starts')
    act(() => void fireEvent.change(select, { target: { value: 'after-previous' } }))

    const dialog = container.querySelector('[role="alertdialog"]')!
    expect(dialog).toBeTruthy()
    act(() => void fireEvent.click(within(dialog as HTMLElement).getByRole('button', { name: /keep the timing/i })))
    expect(container.querySelector('[role="alertdialog"]')).toBeNull()
  })
})
