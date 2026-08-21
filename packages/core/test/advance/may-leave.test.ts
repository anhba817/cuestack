import { describe, expect, it } from 'vitest'
import { learnerMayLeave } from '../../src/index.js'
import { createAdvanceHarness, signals, snapshot } from '../harness/advance.js'
import { slide, textElement } from '../harness/corpus.js'

/** A question *element*, matching the local helper `unsatisfiable.test.ts` already uses. */
const questionElement = (overrides: Record<string, unknown> = {}) =>
  textElement({
    id: 'q',
    type: 'question',
    startMs: 0,
    endMs: 4000,
    effects: [],
    payload: {
      interactionType: 'true_false',
      prompt: 'Ready?',
      options: [
        { id: 'y', label: 'Y' },
        { id: 'n', label: 'N' },
      ],
      correctResponse: 'y',
      required: true,
    },
    ...overrides,
  })

/**
 * FR-003d — the question a navigation control has to ask, in a form that can be asked.
 *
 * **Not "would this slide advance now".** A Continue button on a timed slide is a skip-ahead and
 * must work before the duration elapses. The question is narrower and different: *would anything
 * refuse a learner who asked to leave right now?*
 *
 * It exists because the rule was previously unaskable. It lives inside `evaluate`, which records
 * that a slide has decided — so computing a control's availability by calling `evaluate` consumes
 * the decision the slide needed and the slide never advances. The conditions themselves live in a
 * module no adapter can import: `@cuestack/core` has a single entry point.
 *
 * Without this, BR-005 gets reimplemented in two adapters and they diverge.
 */
describe('learnerMayLeave', () => {
  it('says yes on a slide that continues on request', () => {
    const s = slide([textElement({ effects: [] })], { advance: { mode: 'on_click' } })
    expect(learnerMayLeave(s, signals())).toBe(true)
  })

  it('says yes on a timed slide before its duration elapses', () => {
    /**
     * The case that makes this not a wrapper around "would it advance". A Continue button on a
     * timed slide is a skip-ahead: it must be operable from the first frame, long before the
     * clock would have moved the learner on by itself.
     */
    const s = slide([textElement({ effects: [] })], {
      durationMs: 10000,
      advance: { mode: 'after_duration' },
    })
    expect(learnerMayLeave(s, signals())).toBe(true)
  })

  it('says no while a required question is unanswered — on every advance mode', () => {
    /**
     * BR-005: *"a required interaction shall override automatic slide advancement until
     * completion"*, and the kernel enforces it before it reaches the mode branches. A rule that
     * enumerated the modes missed this and would have let a Continue button skip a required
     * question on a timed slide.
     */
    for (const mode of ['on_click', 'after_duration'] as const) {
      const s = slide([textElement({ effects: [] }), questionElement()], {
        durationMs: 1000,
        advance: { mode },
      })
      expect(learnerMayLeave(s, signals()), mode).toBe(false)
      expect(
        learnerMayLeave(s, signals({ completedInteractions: new Set(['q']) })),
        `${mode} after answering`,
      ).toBe(true)
    }
  })

  it('says no on a slide whose mode declares its own gate', () => {
    // Nothing a learner asks can satisfy these; the slide leaves by its own rule or not at all.
    const gated = [
      { mode: 'after_interaction', interactionElementId: 'q' },
      { mode: 'after_media_ends', mediaElementId: 'v' },
    ] as const
    for (const advance of gated) {
      const s = slide([textElement({ effects: [] })], { advance })
      expect(learnerMayLeave(s, signals()), advance.mode).toBe(false)
    }
  })

  it('ignores an unrequired question', () => {
    // BR-005 is about *required* interactions. An optional one never holds a learner.
    const optional = questionElement({
      payload: {
        interactionType: 'true_false',
        prompt: 'Ready?',
        options: [
          { id: 'y', label: 'Y' },
          { id: 'n', label: 'N' },
        ],
        correctResponse: 'y',
        required: false,
      },
    })
    const s = slide([optional], { advance: { mode: 'on_click' } })
    expect(learnerMayLeave(s, signals())).toBe(true)
  })

  it('changes nothing — the slide still decides afterwards', () => {
    /**
     * **The assertion this whole function exists for.** The obvious way to answer the question is
     * `evaluate`, and `evaluate` records the decision: a speculative call consumes the one the
     * slide needed and it never advances again. Asking must be free.
     */
    const s = slide([textElement({ effects: [] })], { advance: { mode: 'on_click' } })
    const { controller } = createAdvanceHarness()

    for (let i = 0; i < 5; i += 1) expect(learnerMayLeave(s, signals())).toBe(true)

    const decision = controller.evaluate(s, snapshot(), signals({ learnerAdvanced: true }))
    expect(decision?.cause, 'asking must not consume the decision').toBe('learner_action')
  })
})
