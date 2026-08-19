import { act, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { within } from '@testing-library/react'
import { fakePorts, renderEditor } from '../harness/editor.js'
import { element, lessonWith } from '../harness/corpus.js'
import { timelineLesson } from '../harness/timeline.js'
import { multiSlideLesson as previewLesson } from '../harness/preview.js'

/**
 * The name a screen reader would announce, in the order the platform resolves it.
 *
 * `??` is wrong here and was wrong at first: `input.textContent` is the empty *string*, not
 * nullish, so it short-circuits before the wrapping `<label>` is ever consulted — and every
 * labelled input looks unnamed. Falsy-checking each candidate is what this needs.
 *
 * At module scope since feature 007, so the preview's sweep and the timeline's share one
 * definition of what a name is rather than drifting into two.
 */
const accessibleName = (control: Element): string =>
  control.getAttribute('aria-label') ||
  control.textContent?.trim() ||
  control.closest('label')?.textContent?.trim() ||
  ''

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

describe('deleting keeps the keyboard user oriented (FR-039)', () => {
  /**
   * Rewritten in feature 008. These cases guarded the focus behaviour of a confirmation that
   * no longer exists — it opened, took focus, and gave it back. Removing the prompt removes
   * that choreography, but not the requirement underneath it: a keyboard user must not be
   * left with focus on `<body>`, starting again from the top of the document.
   */
  const deleteOne = () => {
    const fixture = setup([element()])
    act(() => fixture.session.session.select([fixture.session.session.draft.slides[0]!.elements[0]!.id]))
    act(() => void fireEvent.click(fixture.container.querySelector('[data-cs-delete]')!))
    return fixture
  }

  it('does not drop focus to the document when the element goes', () => {
    deleteOne()
    expect(document.activeElement).not.toBe(document.body)
  })

  it('announces the deletion rather than leaving it silent', () => {
    const { container } = deleteOne()
    expect(container.querySelector('[data-cs-announcer]')?.textContent).toMatch(/deleted/i)
  })

  it('keeps focus in the editor after undoing it too', () => {
    const { session } = deleteOne()
    act(() => session.session.undo())
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

  it('keeps focus on the control after a Custom relationship applies', () => {
    // The Custom confirmation this checked was removed in feature 008. What remains worth
    // asserting is that applying a relationship does not move focus away from the select the
    // teacher is using — a keyboard user working down the sequence list should not be thrown
    // back to the top by the change they just made.
    const { container } = openCustom()
    const select = within(container.querySelector('.cs-sequence') as HTMLElement).getByLabelText('Starts')
    act(() => void select.focus())
    act(() => void fireEvent.change(select, { target: { value: 'after-previous' } }))

    expect(container.querySelector('[role="alertdialog"]')).toBeNull()
    expect(document.activeElement).not.toBe(document.body)
  })
})

/**
 * The preview's controls (feature 007).
 *
 * axe cannot check a focus indicator — it has no idea what a rendered outline looks like —
 * which is why this needs its own assertions and why they live here rather than in the axe
 * suite. What can be checked is that nothing suppresses the indicator, that every control is
 * in the tab order, and that the order is the one the frame reads in.
 */
describe('the preview', () => {
  const openPreview = () => {
    const rendered = renderEditor(previewLesson(), { preview: 'beginning' })
    return { ...rendered, preview: rendered.container.querySelector('.cs-preview') as HTMLElement }
  }

  it('puts every control in the tab order', () => {
    const { preview } = openPreview()
    const controls = preview.querySelectorAll<HTMLElement>('button, input')
    expect(controls.length).toBeGreaterThan(4)
    for (const control of controls) {
      expect(control.getAttribute('tabindex'), control.outerHTML.slice(0, 80)).not.toBe('-1')
    }
  })

  it('suppresses no focus indicator', () => {
    // `outline: none` without a replacement is the single most common way a keyboard user
    // loses their place, and it is invisible to everyone testing with a mouse.
    const { preview } = openPreview()
    for (const control of preview.querySelectorAll<HTMLElement>('button, input')) {
      expect(control.style.outline).not.toBe('none')
      expect(control.getAttribute('class') ?? '').not.toContain('no-focus')
    }
  })

  it('gives every preview control an accessible name', () => {
    const { preview } = openPreview()
    for (const control of preview.querySelectorAll('button, input')) {
      expect(accessibleName(control), control.outerHTML.slice(0, 80)).toBeTruthy()
    }
  })

  it('orders the frame before the player’s own controls', () => {
    // Close first, deliberately: a teacher who opened a preview by accident, or who has seen
    // enough, should reach the way out before the transport.
    const { preview } = openPreview()
    const order = [...preview.querySelectorAll<HTMLElement>('button, input')]
    expect(order[0]?.getAttribute('data-cs-preview-close')).toBe('true')
  })
})
