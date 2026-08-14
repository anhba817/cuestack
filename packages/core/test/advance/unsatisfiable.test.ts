import { describe, expect, it } from 'vitest'
import { createAdvanceHarness } from '../harness/advance.js'
import { slide, textElement } from '../harness/corpus.js'

const question = (overrides: Record<string, unknown> = {}) =>
  textElement({
    id: 'q',
    type: 'question',
    startMs: 0,
    endMs: 4000,
    effects: [],
    payload: {
      interactionType: 'true_false',
      prompt: 'p',
      options: [{ id: 'y', label: 'Y' }, { id: 'n', label: 'N' }],
      correctResponse: 'y',
      required: true,
    },
    ...overrides,
  })

/** SC-012: an unsatisfiable rule is reported, not left as a lesson that stopped. */
describe('unsatisfiable advance rules', () => {
  it('reports a question that disappears before the slide ends', () => {
    const s = slide([question({ endMs: 4000 })], {
      durationMs: 10000,
      advance: { mode: 'after_interaction', interactionElementId: 'q' },
    })
    const blocked = createAdvanceHarness().controller.reachability(s)
    expect(blocked?.code).toBe('ADVANCE_UNSATISFIABLE')
    expect(blocked?.elementId).toBe('q')
    expect(blocked?.message).toMatch(/disappear|before/i)
  })

  it('accepts a question that lasts as long as the slide', () => {
    const s = slide([question({ endMs: 10000 })], {
      durationMs: 10000,
      advance: { mode: 'after_interaction', interactionElementId: 'q' },
    })
    expect(createAdvanceHarness().controller.reachability(s)).toBeNull()
  })

  it('reports a reference to a question that is not required', () => {
    const s = slide(
      [question({ payload: { interactionType: 'true_false', prompt: 'p', options: [{ id: 'y', label: 'Y' }, { id: 'n', label: 'N' }], correctResponse: 'y', required: false }, endMs: 10000 })],
      { durationMs: 10000, advance: { mode: 'after_interaction', interactionElementId: 'q' } },
    )
    expect(createAdvanceHarness().controller.reachability(s)?.code).toBe('ADVANCE_UNSATISFIABLE')
  })

  it('reports nothing for the two rules that cannot be unsatisfiable', () => {
    for (const mode of ['after_duration', 'on_click'] as const) {
      const s = slide([textElement({ effects: [] })], { durationMs: 1000, advance: { mode } })
      expect(createAdvanceHarness().controller.reachability(s)).toBeNull()
    }
  })
})
