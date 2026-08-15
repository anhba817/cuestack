import { describe, expect, it } from 'vitest'
import { createAdvanceHarness } from '../harness/advance.js'
import { slide, textElement } from '../harness/corpus.js'
import { emptyInteractionState, submit } from '../../src/interactions/state.js'
import { question } from '../harness/interactions.js'

/** BR-005 — a required interaction overrides automatic slide advancement. */
function questionPayload(required: boolean) {
  // `as const` on the discriminant: without it TypeScript widens it to `string` and the
  // payload no longer satisfies the question variant of the element union. Inlined, the
  // literal was contextually typed; extracted into a helper, it needs saying.
  return {
    interactionType: 'true_false' as const,
    prompt: 'Report near-misses?',
    options: [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' },
    ],
    correctResponse: 'yes',
    required,
  }
}

function questionSlide(required: boolean) {
  return slide(
    [
      textElement({
        id: 'q',
        type: 'question',
        payload: questionPayload(required),
        startMs: 0,
        endMs: 10000,
        effects: [],
      }),
    ],
    { durationMs: 10000, advance: { mode: 'after_duration' } },
  )
}

describe('BR-005', () => {
  it('withholds advancement while a required interaction is incomplete', () => {
    const h = createAdvanceHarness()
    expect(h.evaluate(questionSlide(true), { slideTimeMs: 10000 })).toBeNull()
  })

  it('advances once the required interaction completes', () => {
    const h = createAdvanceHarness()
    const s = questionSlide(true)
    expect(h.evaluate(s, { slideTimeMs: 10000 })).toBeNull()
    const decision = h.evaluate(s, { slideTimeMs: 10000 }, { completedInteractions: new Set(['q']) })
    expect(decision?.cause).toBe('duration')
  })

  it('does not withhold for an optional interaction', () => {
    const h = createAdvanceHarness()
    expect(h.evaluate(questionSlide(false), { slideTimeMs: 10000 })).not.toBeNull()
  })

  /**
   * Wave 3: the same rule, driven by a learner's actual answers rather than by a set a test
   * constructed by hand.
   *
   * The gate itself needed no writing — `hasIncompleteRequiredInteraction` has implemented
   * BR-005 since Wave 1 and was passed an empty set for two waves. What is new is that
   * something now fills it, and what these assert is that *completion under the authored
   * policy* is what fills it, not merely "has been answered".
   */
  describe('driven by real interaction state', () => {
    const gated = () => questionSlide(true)

    it('holds a duration-advanced slide while the answer is incomplete under its policy', () => {
      const definition = question({ completionPolicy: 'on_correct', maxAttempts: 3 })
      const { state } = submit(emptyInteractionState(), 'q', definition, 'b', 0)
      const h = createAdvanceHarness()
      expect(
        h.evaluate(gated(), { slideTimeMs: 10000 }, { completedInteractions: state.completedIds }),
      ).toBeNull()
    })

    it('releases it once the policy is satisfied', () => {
      const definition = question({ completionPolicy: 'on_correct', maxAttempts: 3 })
      let state = submit(emptyInteractionState(), 'q', definition, 'b', 0).state
      state = submit(state, 'q', definition, 'a', 1000).state
      const h = createAdvanceHarness()
      expect(
        h.evaluate(gated(), { slideTimeMs: 10000 }, { completedInteractions: state.completedIds }),
      ).not.toBeNull()
    })

    it('releases on any answer when the policy is on_first_attempt', () => {
      // The default. A wrong answer completes it, which is the whole difference from
      // `on_correct` and the reason the default matters.
      const { state } = submit(emptyInteractionState(), 'q', question(), 'b', 0)
      const h = createAdvanceHarness()
      expect(
        h.evaluate(gated(), { slideTimeMs: 10000 }, { completedInteractions: state.completedIds }),
      ).not.toBeNull()
    })

    it('needs every required question on the slide, not just one', () => {
      // The rule applies across the slide rather than to a question an advance rule names —
      // a duration-advanced slide carrying two required questions waits for both, or the
      // learner loses one of them.
      const two = slide(
        [
          textElement({ id: 'q', type: 'question', payload: questionPayload(true), startMs: 0, endMs: 10000, effects: [] }),
          textElement({ id: 'q2', type: 'question', payload: questionPayload(true), startMs: 0, endMs: 10000, effects: [] }),
        ],
        { durationMs: 10000, advance: { mode: 'after_duration' } },
      )
      const { state } = submit(emptyInteractionState(), 'q', question(), 'a', 0)
      const h = createAdvanceHarness()
      expect(
        h.evaluate(two, { slideTimeMs: 10000 }, { completedInteractions: state.completedIds }),
      ).toBeNull()
    })
  })
})
