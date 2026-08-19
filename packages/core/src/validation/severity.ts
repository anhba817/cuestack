import { INHERENT, POLICY_GOVERNED, type IssueSource, type SemanticCode, type Severity } from './codes.js'

/**
 * What an organisation treats as an error rather than a warning.
 *
 * **There is no `off`.** A rule an organisation does not want blocking is a warning, and a rule
 * nobody wants to see is a rule that should not exist. A silenceable set drifts towards silence one
 * incident at a time, and the framework ends up with rules that are technically present and
 * practically absent (FR-010b).
 */
export interface ValidationPolicy {
  /** Codes to raise to `error`. */
  readonly errors?: readonly string[]
  /** Codes to lower to `warning`. */
  readonly warnings?: readonly string[]
}

/**
 * Pure: a code, where it came from, and the host's policy.
 *
 * Three rules, in order of precedence:
 *
 * 1. **A schema issue is always an error**, and no policy moves it. A manifest the format rejects
 *    is not publishable regardless of anybody's rules.
 * 2. **A plugin's code defaults to `error` and is always governable.** Core cannot judge a code it
 *    has never seen — but a plugin reporting a fault in its own payload is reporting something it
 *    believes makes the element wrong, so blocking is the honest default (research R-07).
 * 3. **A semantic code takes its inherent severity**, and moves only if it is policy-governed.
 */
export function severityFor(code: string, source: IssueSource, policy?: ValidationPolicy): Severity {
  if (source === 'schema') return 'error'

  const raised = policy?.errors?.includes(code) ?? false
  const lowered = policy?.warnings?.includes(code) ?? false

  if (source === 'plugin') {
    if (lowered) return 'warning'
    return 'error'
  }

  const inherent = INHERENT[code as SemanticCode] ?? 'error'
  if (!POLICY_GOVERNED.has(code)) return inherent
  if (raised) return 'error'
  if (lowered) return 'warning'
  return inherent
}
