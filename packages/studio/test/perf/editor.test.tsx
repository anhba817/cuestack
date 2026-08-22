import { act, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LessonManifest } from '@cuestack/schema'
import { heavyLesson } from '../harness/heavy.js'
import { fakePorts, renderEditor } from '../harness/editor.js'

/**
 * T108 — SC-001, SC-002, SC-018 on the Constitution's own fixture.
 *
 * **This measures the editor's own work, not paint.** happy-dom has no compositor, so a green
 * line here is not a frame-rate claim and must never be read as one — the same caveat the
 * playback budgets carry, for the same reason. What it does catch is the regression that
 * matters at this scale: a handler that went from O(n) to O(n²) over 300 elements.
 *
 * Budgets come from the constitution rather than from what the code currently does:
 * interaction feedback 100 ms (NFR-PERF-002), a seek 100 ms (NFR-PERF-003), and interactive at
 * 50 slides / 300 elements in 3 s (NFR-PERF-001). Each is held to a further 10% margin so a
 * regression fails while there is still room.
 */
const MARGIN = 0.9
const INTERACTION_MS = 100 * MARGIN
const SEEK_MS = 100 * MARGIN
const INTERACTIVE_MS = 3000 * MARGIN

let fixture: LessonManifest

function elapsed(fn: () => void): number {
  const started = performance.now()
  fn()
  return performance.now() - started
}

describe('the editor at 50 slides and 300 elements', () => {
  it('builds the fixture the constitution names', () => {
    fixture = heavyLesson()
    expect(fixture.slides).toHaveLength(50)
    expect(fixture.slides.reduce((n, s) => n + s.elements.length, 0)).toBe(300)
  })

  it(`becomes interactive within ${INTERACTIVE_MS} ms (SC-002)`, () => {
    const ms = elapsed(() => {
      const { unmount } = renderEditor(fixture)
      unmount()
    })
    console.log(`perf: editor interactive, 50 slides/300 elements | ${ms} | ${INTERACTIVE_MS}`)
    expect(ms).toBeLessThan(INTERACTIVE_MS)
  })

  it(`gives selection feedback within ${INTERACTION_MS} ms (SC-001)`, () => {
    const { handle, container } = renderEditor(fixture)
    const id = handle.session.draft.slides[0]!.elements[0]!.id
    const hit = container.querySelector(`[data-cs-hit][data-cs-element-id="${id}"]`)!

    const ms = elapsed(() => act(() => void fireEvent.pointerDown(hit)))

    expect(handle.session.selection).toEqual([id])
    console.log(`perf: editor selection feedback | ${ms} | ${INTERACTION_MS}`)
    expect(ms).toBeLessThan(INTERACTION_MS)
  })

  it(`renders a moved element within ${INTERACTION_MS} ms (SC-001)`, () => {
    const { handle } = renderEditor(fixture)
    const id = handle.session.draft.slides[0]!.elements[0]!.id
    act(() => handle.session.select([id]))

    const ms = elapsed(() =>
      act(() => void handle.session.apply({
        kind: 'transform-elements',
        ids: [id],
        geometry: { x: 640, y: 360 },
      })),
    )

    console.log(`perf: editor move feedback | ${ms} | ${INTERACTION_MS}`)
    expect(ms).toBeLessThan(INTERACTION_MS)
  })

  it(`changes the authoring time within ${SEEK_MS} ms — it is a seek (SC-018)`, () => {
    // The timeline is now the seek surface (FR-006), so the budget measures what a teacher
    // actually drives — which is also what SC-003 asks for.
    const { handle, container } = renderEditor(fixture, { timeline: true, ports: fakePorts() })
    const scrub = container.querySelector<HTMLInputElement>('.cs-playhead')!

    const ms = elapsed(() => act(() => void fireEvent.change(scrub, { target: { value: '4000' } })))

    expect(handle.session.authoringTime).toBe(4000)
    console.log(`perf: editor authoring-time change | ${ms} | ${SEEK_MS}`)
    expect(ms).toBeLessThan(SEEK_MS)
  })

  it('scales linearly rather than quadratically across the slide set', () => {
    // The shape that matters more than any single number: ten seeks must not cost
    // dramatically more than ten times one.
    const { container } = renderEditor(fixture, { timeline: true, ports: fakePorts() })
    const scrub = container.querySelector<HTMLInputElement>('.cs-playhead')!

    const one = elapsed(() => act(() => void fireEvent.change(scrub, { target: { value: '1000' } })))
    const ten = elapsed(() => {
      for (let i = 1; i <= 10; i += 1) {
        act(() => void fireEvent.change(scrub, { target: { value: String(i * 500) } }))
      }
    })

    // Generous: the point is to catch an order-of-magnitude change, not to measure a machine.
    console.log(`perf: editor slide-set scaling | ${ten} | ${Math.max(one * 40, SEEK_MS * 10)}`)
    expect(ten).toBeLessThan(Math.max(one * 40, SEEK_MS * 10))
  })
})
