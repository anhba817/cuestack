import type { Interaction, InteractionOption } from '@cuestack/schema'

/**
 * Questions and answer sequences, written the way a learner produces them.
 *
 * A policy test is about *a sequence of answers* — wrong, wrong, right — and the thing it
 * must not be about is constructing maps of response objects. When the setup is longer than
 * the assertion, the assertion stops being read.
 */

export interface Submission {
  readonly elementId: string
  readonly selected: string
  readonly atMs: number
}

const OPTIONS: readonly InteractionOption[] = [
  { id: 'a', label: 'A near-miss' },
  { id: 'b', label: 'Nothing' },
  { id: 'c', label: 'Only injuries' },
]

/**
 * A question. `correctResponse` is `'a'` unless told otherwise, so a test that says
 * `answer('a')` reads as "answered correctly" without a lookup.
 */
export function question(overrides: Partial<Interaction> = {}): Interaction {
  return {
    interactionType: 'multiple_choice',
    prompt: 'Which of these must be reported?',
    options: OPTIONS,
    correctResponse: 'a',
    required: true,
    ...overrides,
  } as Interaction
}

/** The dead end the spec names: one attempt, must be correct, answered wrongly. */
export function unsatisfiableQuestion(): Interaction {
  return question({ completionPolicy: 'on_correct', maxAttempts: 1 })
}

/**
 * A sequence of answers to one element, at one-second intervals.
 *
 * The times are incidental — nothing reads `atMs` to decide anything, it exists for the
 * event payload — so they are generated rather than stated, and a test that cares can pass
 * its own.
 */
export function answers(
  elementId: string,
  selected: readonly string[],
  startMs = 0,
  stepMs = 1000,
): Submission[] {
  return selected.map((choice, i) => ({
    elementId,
    selected: choice,
    atMs: startMs + i * stepMs,
  }))
}

/** Shorthand for the two cases every policy test needs. */
export const correct = (elementId: string, times = 1): Submission[] =>
  answers(elementId, Array.from({ length: times }, () => 'a'))

export const wrong = (elementId: string, times = 1): Submission[] =>
  answers(elementId, Array.from({ length: times }, () => 'b'))
