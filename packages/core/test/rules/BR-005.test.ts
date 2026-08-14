import { describe, expect, it } from 'vitest'
import { createAdvanceHarness } from '../harness/advance.js'
import { slide, textElement } from '../harness/corpus.js'

/** BR-005 — a required interaction overrides automatic slide advancement. */
function questionSlide(required: boolean) {
  return slide(
    [
      textElement({
        id: 'q',
        type: 'question',
        payload: {
          interactionType: 'true_false',
          prompt: 'Report near-misses?',
          options: [
            { id: 'yes', label: 'Yes' },
            { id: 'no', label: 'No' },
          ],
          correctResponse: 'yes',
          required,
        },
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
})
