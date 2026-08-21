/**
 * What the semantic tier can say, and how strongly by default.
 *
 * A closed union owned by core, separate from `@cuestack/schema`'s `ISSUE_CODES` — that one is the
 * schema package's public contract, and "this question traps a learner" is not a statement about
 * the format (research R-03).
 *
 * **Two of these strings also appear in `ISSUE_CODES`.** `UNKNOWN_ELEMENT_TYPE` and
 * `UNKNOWN_EFFECT_TYPE` mean different things at the two tiers — the schema means "no such type in
 * the format", the resolver means "no such type in *this* registry" — which is why every issue
 * carries a `source` and why two unions alone would not have delivered what they were for.
 *
 * The list is exhaustive over what the four sources emit. An omitted code is one the report cannot
 * carry.
 */
export const SEMANTIC_CODES = [
  // The one rule this tier owns outright.
  'QUESTION_DEAD_END',
  // From checkReachability.
  'ADVANCE_UNSATISFIABLE',
  'ADVANCE_MEDIA_FAILED',
  'UNKNOWN_REQUIRED_INTERACTION',
  'NAVIGATION_INOPERABLE',
  // From collectProblems.
  'ELEMENT_BEYOND_SLIDE',
  'EFFECT_BEYOND_SLIDE',
  'UNKNOWN_ELEMENT_TYPE',
  'UNKNOWN_EFFECT_TYPE',
  // From the engine, reading a common field a plugin cannot see.
  'ACCESSIBILITY_METADATA_ABSENT',
  // From the separate, optional asset pass.
  'ASSET_UNRESOLVED',
  // A plugin whose own validate threw.
  'PLUGIN_VALIDATE_FAILED',
] as const

export type SemanticCode = (typeof SEMANTIC_CODES)[number]

/** Which validator produced an issue. Without this, two codes are ambiguous (research R-03). */
export type IssueSource = 'schema' | 'semantic' | 'plugin'

export type Severity = 'error' | 'warning'

/**
 * The inherent severity of each semantic code.
 *
 * `ELEMENT_BEYOND_SLIDE` and `EFFECT_BEYOND_SLIDE` are warnings, which is a judgement worth
 * stating: neither renders past the boundary — the player simply stops — so the lesson is playable.
 * Both are almost always a mistake and occasionally a deliberate margin, and BR-017 already requires
 * the *timeline* to report an overrun rather than prevent it.
 */
export const INHERENT: Readonly<Record<SemanticCode, Severity>> = {
  QUESTION_DEAD_END: 'error',
  ADVANCE_UNSATISFIABLE: 'error',
  ADVANCE_MEDIA_FAILED: 'error',
  UNKNOWN_REQUIRED_INTERACTION: 'error',
  ELEMENT_BEYOND_SLIDE: 'warning',
  // A control that can never be operated is an authoring mistake, not a dead end: the slide is
  // satisfiable through its own gate, so refusing to publish would refuse a working lesson.
  NAVIGATION_INOPERABLE: 'warning',
  EFFECT_BEYOND_SLIDE: 'warning',
  UNKNOWN_ELEMENT_TYPE: 'error',
  UNKNOWN_EFFECT_TYPE: 'error',
  ACCESSIBILITY_METADATA_ABSENT: 'warning',
  ASSET_UNRESOLVED: 'warning',
  PLUGIN_VALIDATE_FAILED: 'error',
}

/**
 * Which codes an organisation's policy may move.
 *
 * A property of the code rather than of the policy, so a policy cannot make a structural error into
 * a warning: a manifest the format rejects is not publishable regardless of anybody's rules.
 *
 * Accessibility metadata is the case BR-012 exists for — "enforced as an error or warning according
 * to organization policy" — so the rule itself cannot decide, and the default is what every
 * organisation that never sets one gets.
 */
export const POLICY_GOVERNED: ReadonlySet<string> = new Set<SemanticCode>([
  'ACCESSIBILITY_METADATA_ABSENT',
])
