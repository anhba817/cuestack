import { describe, expect, it } from 'vitest'
import { isComplete, COMPLETION_POLICIES } from '../../src/interactions/policy.js'

/**
 * The three completion policies, which decide whether a required question releases a slide.
 *
 * One table, not three call sites — the gate and the display must reach the same conclusion
 * from the same answer, and the surest way is for there to be one function.
 */

const attempt = (correct: boolean) => ({ correct })

describe('on_first_attempt', () => {
  const complete = (answers: boolean[]) =>
    isComplete('on_first_attempt', answers.map(attempt), undefined)

  it('is incomplete with no answer', () => {
    expect(complete([])).toBe(false)
  })

  it('completes on any answer, right or wrong', () => {
    expect(complete([false])).toBe(true)
    expect(complete([true])).toBe(true)
  })
})

describe('on_correct', () => {
  const complete = (answers: boolean[]) => isComplete('on_correct', answers.map(attempt), undefined)

  it('is incomplete while every answer is wrong', () => {
    expect(complete([false, false, false])).toBe(false)
  })

  it('completes once an answer is correct, wherever in the sequence', () => {
    expect(complete([false, true])).toBe(true)
    expect(complete([true, false])).toBe(true)
  })
})

describe('on_attempts_exhausted', () => {
  const complete = (answers: boolean[], maxAttempts?: number) =>
    isComplete('on_attempts_exhausted', answers.map(attempt), maxAttempts)

  it('completes early on a correct answer, without spending the rest', () => {
    // "Exhausted" is the *fallback*, not the requirement. A learner who gets it right on the
    // first of three tries is done, and holding them for two more would be a punishment for
    // being correct.
    expect(complete([true], 3)).toBe(true)
  })

  it('is incomplete while wrong answers remain available', () => {
    expect(complete([false], 3)).toBe(false)
    expect(complete([false, false], 3)).toBe(false)
  })

  it('completes when the attempts run out', () => {
    expect(complete([false, false, false], 3)).toBe(true)
  })

  it('never completes on wrong answers when attempts are unlimited', () => {
    // No maxAttempts means there is nothing to exhaust. The policy then behaves as
    // `on_correct`, which is the only reading that does not deadlock silently.
    expect(complete([false, false, false, false, false])).toBe(false)
    expect(complete([false, true])).toBe(true)
  })
})

describe('the policy set', () => {
  it('covers exactly the three the format defines', () => {
    expect([...COMPLETION_POLICIES].sort()).toEqual([
      'on_attempts_exhausted',
      'on_correct',
      'on_first_attempt',
    ])
  })

  it('defaults to on_first_attempt when the author said nothing', () => {
    // The least restrictive reading. A question whose author did not say it must be answered
    // *correctly* should not trap a learner who got it wrong.
    expect(isComplete(undefined, [attempt(false)], undefined)).toBe(true)
  })
})
