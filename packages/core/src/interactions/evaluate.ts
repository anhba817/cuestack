import type { Interaction } from '@cuestack/schema'
import {
  isComplete,
  isUnsatisfiable,
  type AttemptSummary,
  type CompletionPolicy,
} from './policy.js'

/**
 * What the gate reads, derived from the responses rather than stored beside them.
 *
 * A stored outcome is a second copy of something computable, and the two disagree the moment
 * the policy is read twice.
 */
export interface InteractionOutcome {
  /** What gating reads (BR-005). */
  readonly complete: boolean
  /** Whether a correct answer has been given at all. */
  readonly correct: boolean
  readonly attemptsUsed: number
  /** `null` when unlimited — a number here would be a lie a renderer would display. */
  readonly attemptsRemaining: number | null
  /** Out of attempts and not correct. */
  readonly exhausted: boolean
  /** Complete can never be reached. Feeds `ADVANCE_UNSATISFIABLE` rather than a silent stall. */
  readonly unsatisfiable: boolean
}

/** Only what evaluation needs from a response. */
export interface EvaluatedResponse extends AttemptSummary {
  readonly selected: string | readonly string[]
}

/** Whether a selection matches what the author marked correct. */
export function isCorrectResponse(
  definition: Pick<Interaction, 'correctResponse'>,
  selected: string | readonly string[],
): boolean {
  const expected = definition.correctResponse
  const chosen = Array.isArray(selected) ? selected : [selected]
  if (Array.isArray(expected)) {
    return chosen.length > 0 && chosen.every((c) => expected.includes(c))
  }
  return chosen.length === 1 && chosen[0] === expected
}

export function evaluate(
  definition: Interaction,
  responses: readonly EvaluatedResponse[],
): InteractionOutcome {
  const policy = definition.completionPolicy as CompletionPolicy | undefined
  const maxAttempts = definition.maxAttempts
  const attemptsUsed = responses.length
  const correct = responses.some((r) => r.correct)

  return {
    complete: isComplete(policy, responses, maxAttempts),
    correct,
    attemptsUsed,
    // Never negative: "-1 attempts remaining" is a defect a learner sees.
    attemptsRemaining: maxAttempts === undefined ? null : Math.max(0, maxAttempts - attemptsUsed),
    exhausted: maxAttempts !== undefined && attemptsUsed >= maxAttempts && !correct,
    unsatisfiable: isUnsatisfiable(policy, responses, maxAttempts),
  }
}
