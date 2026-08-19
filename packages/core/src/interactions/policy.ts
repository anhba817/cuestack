/**
 * When an interaction counts as complete.
 *
 * One table, not three call sites. Whether a required question releases a slide is a rule
 * about lessons, not about React — a second adapter must reach the same conclusion from the
 * same answer, and the gate and the display must never disagree. Putting the policy in a
 * renderer would guarantee they eventually do.
 */

export const COMPLETION_POLICIES = [
  'on_first_attempt',
  'on_correct',
  'on_attempts_exhausted',
] as const

export type CompletionPolicy = (typeof COMPLETION_POLICIES)[number]

/**
 * The least restrictive reading, chosen deliberately.
 *
 * A question whose author did not say it must be answered *correctly* should not trap a
 * learner who got it wrong. Defaulting to `on_correct` would turn every unconfigured
 * required question into a potential dead end.
 */
export const DEFAULT_COMPLETION_POLICY: CompletionPolicy = 'on_first_attempt'

/** Only what the policy needs to see. */
export interface AttemptSummary {
  readonly correct: boolean
}

const RULES: Record<
  CompletionPolicy,
  (attempts: readonly AttemptSummary[], maxAttempts: number | undefined) => boolean
> = {
  on_first_attempt: (attempts) => attempts.length > 0,

  on_correct: (attempts) => attempts.some((a) => a.correct),

  /**
   * Exhaustion is the *fallback*, not the requirement: a correct answer completes
   * immediately rather than spending the remaining tries, because holding a learner who got
   * it right is a punishment for being right.
   *
   * With no `maxAttempts` there is nothing to exhaust, so this behaves as `on_correct`. The
   * alternative — treating unlimited as immediately exhausted — would complete the question
   * on any wrong answer, which is the opposite of what the policy names.
   */
  on_attempts_exhausted: (attempts, maxAttempts) => {
    if (attempts.some((a) => a.correct)) return true
    if (maxAttempts === undefined) return false
    return attempts.length >= maxAttempts
  },
}

export function isComplete(
  policy: CompletionPolicy | undefined,
  attempts: readonly AttemptSummary[],
  maxAttempts: number | undefined,
): boolean {
  return RULES[policy ?? DEFAULT_COMPLETION_POLICY](attempts, maxAttempts)
}

/**
 * Whether completion can never be reached from here.
 *
 * Only `on_correct` can dead-end: the learner is out of attempts and has not been right.
 * `on_first_attempt` completes on anything, and `on_attempts_exhausted` completes by
 * definition when the attempts run out — both always terminate.
 *
 * The kernel does not rescue the learner by opening the gate. That would make the policy
 * mean something other than what it says. It reports the condition, the player presents a
 * way forward (FR-030), and Wave 5's validation engine warns the author before a learner
 * ever meets it.
 */
export function isUnsatisfiable(
  policy: CompletionPolicy | undefined,
  attempts: readonly AttemptSummary[],
  maxAttempts: number | undefined,
): boolean {
  if ((policy ?? DEFAULT_COMPLETION_POLICY) !== 'on_correct') return false
  if (attempts.some((a) => a.correct)) return false
  if (maxAttempts === undefined) return false
  return attempts.length >= maxAttempts
}

/**
 * Whether this question *could* trap somebody, before anybody tries.
 *
 * The static counterpart of `isUnsatisfiable` above, and it lives here rather than in the
 * validation engine because they are one rule asked at two moments — "has this learner run out"
 * and "could anyone run out" — and that is exactly the pair which comes to disagree when separated.
 * This file already carries the subtleties: `on_first_attempt` completes on anything,
 * `on_attempts_exhausted` completes by definition, unlimited attempts cannot exhaust. A predicate
 * written elsewhere would restate all three from memory and be wrong the first time
 * `DEFAULT_COMPLETION_POLICY` changed.
 *
 * `isUnsatisfiable`'s own header named this consumer before it existed: "Wave 5's validation engine
 * warns the author before a learner ever meets it."
 *
 * The default matters and is already right. `DEFAULT_COMPLETION_POLICY` is `on_first_attempt`,
 * chosen because "defaulting to `on_correct` would turn every unconfigured required question into a
 * potential dead end" — so an author who configures nothing cannot make one.
 */
export function isDeadEnd(
  policy: CompletionPolicy | undefined,
  maxAttempts: number | undefined,
): boolean {
  if ((policy ?? DEFAULT_COMPLETION_POLICY) !== 'on_correct') return false
  // Unlimited attempts always terminate, so reporting them would be a warning about nothing —
  // and warnings about nothing are how a report stops being read.
  return maxAttempts !== undefined
}
