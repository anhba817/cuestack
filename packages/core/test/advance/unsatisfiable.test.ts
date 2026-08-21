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

  it('reports nothing for the one rule that cannot be unsatisfiable', () => {
    /**
     * **This assertion used to cover `on_click` too, and that was the defect.**
     *
     * Its premise — a learner can always click — is sound in general and was false here: nothing
     * raised the signal, and the player's controls offer play, pause and seek but no next. So a
     * teacher authored such a slide, this check passed it, publishing accepted it, and every
     * learner stopped there permanently *because* the checker was certain the mode could not
     * strand anyone.
     *
     * It was split rather than widened. Relaxing a negative assertion to accept new behaviour is
     * a one-character edit that also stops it catching anything, and `after_duration` genuinely
     * cannot be unsatisfiable — a clock always runs out.
     */
    const s = slide([textElement({ effects: [] })], {
      durationMs: 1000,
      advance: { mode: 'after_duration' },
    })
    expect(createAdvanceHarness().controller.reachability(s)).toBeNull()
  })

  describe('a slide that continues when the learner asks', () => {
    const continueButton = (overrides: Record<string, unknown> = {}) =>
      textElement({
        id: 'go',
        type: 'button',
        effects: [],
        payload: { label: 'Continue', action: 'next_slide' },
        ...overrides,
      })

    it('is satisfiable when it carries a control that moves forward', () => {
      const s = slide([textElement({ effects: [] }), continueButton()], {
        durationMs: 1000,
        advance: { mode: 'on_click' },
      })
      expect(createAdvanceHarness().controller.reachability(s)).toBeNull()
    })

    it('is a dead end with no control at all', () => {
      const s = slide([textElement({ effects: [] })], {
        durationMs: 1000,
        advance: { mode: 'on_click' },
      })
      const problem = createAdvanceHarness().controller.reachability(s)
      expect(problem?.code).toBe('ADVANCE_UNSATISFIABLE')
      expect(problem?.message).toMatch(/carries no control/)
    })

    it('is a dead end when every control points backwards, and says so differently', () => {
      /**
       * The easier mistake and the harder to see. An author looking at a slide with a button on
       * it, reading "carries no control", would read that as a fault in the checker.
       */
      const back = continueButton({
        id: 'back',
        payload: { label: 'Back', action: 'previous_slide' },
      })
      const s = slide([textElement({ effects: [] }), back], {
        durationMs: 1000,
        advance: { mode: 'on_click' },
      })
      const problem = createAdvanceHarness().controller.reachability(s)
      expect(problem?.code).toBe('ADVANCE_UNSATISFIABLE')
      expect(problem?.message).toMatch(/do not move them forward/)
      expect(problem?.message).not.toMatch(/carries no control/)
    })
  })
})
