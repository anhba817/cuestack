import { describe, expect, it } from 'vitest'
import { evaluate, isCorrectResponse } from '../../src/interactions/evaluate.js'
import { question, unsatisfiableQuestion } from '../harness/interactions.js'
import type { Interaction } from '@cuestack/schema'
import type { InteractionResponse } from '../../src/interactions/state.js'

/**
 * What the gate reads: complete, correct, attempts, and whether the outcome is reachable.
 *
 * `unsatisfiable` is the field worth having. Without it a dead-end question is
 * indistinguishable from one the learner has not reached yet, and the slide waits forever
 * with nothing to report.
 */

/**
 * Correctness is decided **once, at submission**, against the definition — so a response
 * carries it rather than having it recomputed. That is deliberate: recomputing would let the
 * same answer change correctness if the manifest changed mid-session, and a learner told
 * they were right should stay right.
 *
 * A first draft of this helper hardcoded `choice === 'a'` and then asserted that a question
 * with `correctResponse: ['a', 'c']` marked `'c'` correct. It built a response saying
 * incorrect and expected the outcome to disagree with it.
 */
const responses = (selected: string[], definition: Interaction = question()): InteractionResponse[] =>
  selected.map((choice, i) => ({
    elementId: 'q',
    selected: choice,
    attempt: i + 1,
    correct: isCorrectResponse(definition, choice),
    atMs: i * 1000,
  }))

describe('an unanswered question', () => {
  const outcome = evaluate(question(), [])

  it('is incomplete and not correct', () => {
    expect(outcome.complete).toBe(false)
    expect(outcome.correct).toBe(false)
  })

  it('has used no attempts', () => {
    expect(outcome.attemptsUsed).toBe(0)
  })

  it('reports unlimited attempts as null rather than as a number', () => {
    // A number would be a lie a renderer would display. "3 remaining" and "unlimited" are
    // different things to a learner deciding whether to guess.
    expect(outcome.attemptsRemaining).toBeNull()
  })

  it('is not exhausted and not unsatisfiable', () => {
    expect(outcome.exhausted).toBe(false)
    expect(outcome.unsatisfiable).toBe(false)
  })
})

describe('correctness comes from the manifest, not the renderer', () => {
  it('recognises the authored correct response', () => {
    expect(evaluate(question(), responses(['a'])).correct).toBe(true)
    expect(evaluate(question(), responses(['b'])).correct).toBe(false)
  })

  it('accepts an array of correct responses', () => {
    // The format allows `correctResponse` to be a list. A selection drawn from it is correct.
    const q = question({ correctResponse: ['a', 'c'] })
    expect(evaluate(q, responses(['c'], q)).correct).toBe(true)
    expect(evaluate(q, responses(['b'], q)).correct).toBe(false)
  })

  it('stays correct once correct, even if a later answer is wrong', () => {
    expect(evaluate(question(), responses(['a', 'b'])).correct).toBe(true)
  })
})

describe('attempts', () => {
  const q = question({ maxAttempts: 3 })

  it('counts what has been used', () => {
    expect(evaluate(q, responses(['b', 'b'])).attemptsUsed).toBe(2)
  })

  it('counts what remains', () => {
    expect(evaluate(q, responses(['b'])).attemptsRemaining).toBe(2)
    expect(evaluate(q, responses(['b', 'b', 'b'])).attemptsRemaining).toBe(0)
  })

  it('never reports a negative remainder', () => {
    // A renderer showing "-1 attempts remaining" is a defect a learner sees.
    expect(evaluate(q, responses(['b', 'b', 'b', 'b'])).attemptsRemaining).toBe(0)
  })

  it('is exhausted only when out of attempts and still wrong', () => {
    expect(evaluate(q, responses(['b', 'b', 'b'])).exhausted).toBe(true)
    expect(evaluate(q, responses(['a'])).exhausted).toBe(false)
  })
})

describe('unsatisfiable', () => {
  it('is reported for on_correct with no attempts left and no correct answer', () => {
    // The dead end the format permits: one attempt, must be right, answered wrongly. The
    // kernel does not quietly open the gate — that would make the policy mean something
    // other than what it says — it reports that the outcome can never be reached.
    const outcome = evaluate(unsatisfiableQuestion(), responses(['b']))
    expect(outcome.complete).toBe(false)
    expect(outcome.unsatisfiable).toBe(true)
  })

  it('is not reported while an attempt remains', () => {
    const q = question({ completionPolicy: 'on_correct', maxAttempts: 2 })
    expect(evaluate(q, responses(['b'])).unsatisfiable).toBe(false)
  })

  it('is not reported once the learner is correct', () => {
    expect(evaluate(unsatisfiableQuestion(), responses(['a'])).unsatisfiable).toBe(false)
  })

  it('is never reported for on_attempts_exhausted, which always terminates', () => {
    const q = question({ completionPolicy: 'on_attempts_exhausted', maxAttempts: 1 })
    const outcome = evaluate(q, responses(['b']))
    expect(outcome.complete).toBe(true)
    expect(outcome.unsatisfiable).toBe(false)
  })
})
