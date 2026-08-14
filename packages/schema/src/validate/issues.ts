/**
 * The issue vocabulary. `code` values are part of the public contract — callers
 * branch on them. `message` is human-facing and may be reworded in a patch.
 *
 * See specs/001-framework-foundation/contracts/schema-package-api.md.
 */

export const ISSUE_CODES = [
  // structural
  'SCHEMA_VERSION_ABSENT',
  'SCHEMA_VERSION_UNSUPPORTED',
  'UNKNOWN_FIELD',
  'REQUIRED_FIELD_MISSING',
  'TYPE_MISMATCH',
  'ENUM_VALUE_INVALID',
  'LESSON_HAS_NO_SLIDES',
  'UNKNOWN_ELEMENT_TYPE',
  'UNKNOWN_EFFECT_TYPE',
  'GEOMETRY_NOT_NUMERIC',
  // timing
  'TIMING_NOT_INTEGER',
  'TIMING_NEGATIVE',
  'TIMING_END_BEFORE_START',
  'EFFECT_DURATION_NOT_POSITIVE',
  // referential
  'DUPLICATE_ID',
  'ADVANCE_MEDIA_NOT_FOUND',
  'ADVANCE_MEDIA_WRONG_TYPE',
  'ADVANCE_INTERACTION_NOT_FOUND',
  'ADVANCE_INTERACTION_NOT_REQUIRED',
  'CORRECT_RESPONSE_UNKNOWN_OPTION',
  // migration
  'MIGRATION_CHAIN_INCOMPLETE',
  'MIGRATION_STEP_FAILED',
] as const

export type IssueCode = (typeof ISSUE_CODES)[number]

/** Where in the document the problem is, in terms an editor can navigate to. */
export interface IssueLocation {
  slideId?: string
  slideIndex?: number
  elementId?: string
  elementIndex?: number
  field?: string
}

export interface ValidationIssue {
  code: IssueCode
  /** The business rule this violates, where one applies (e.g. "BR-003"). */
  rule?: string
  path: Array<string | number>
  location: IssueLocation
  message: string
}

export type ValidationResult<T> =
  | { ok: true; lesson: T }
  | { ok: false; issues: ValidationIssue[] }

/** Params smuggled through a Zod custom issue so the code survives mapping. */
export interface CustomIssueParams {
  code: IssueCode
  rule?: string
}
