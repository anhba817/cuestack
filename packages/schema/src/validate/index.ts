import { lessonManifestSchema, type LessonManifestOutput } from './lesson.js'
import { mapIssue } from './map-issue.js'
import { checkReferences } from './referential.js'
import type { ValidationIssue, ValidationResult } from './issues.js'

export type { ValidationIssue, ValidationResult, IssueCode, IssueLocation } from './issues.js'
export { ISSUE_CODES } from './issues.js'
export { describeFormat, type FormatField } from './introspect.js'
export { CURRENT_SCHEMA_VERSION } from './lesson.js'
/**
 * FR-CAN-001's element set, as a value rather than only a type.
 *
 * Added in feature 005 so the editor can assert that every type the format supports has an
 * editor registration — a type in the schema with none is a type the Add menu silently
 * omits, which a teacher discovers rather than a test. The `ElementType` union has been
 * exported from the root since Wave 0; this is the same list at runtime.
 *
 * Exported from `/validate` and deliberately not from the root: the root entry compiles to
 * zero runtime bytes and a runtime export there would be a breaking change to the package
 * contract.
 */
export { ELEMENT_TYPES } from './element.js'

/**
 * Validate a lesson manifest.
 *
 * Never throws — an invalid lesson is an expected outcome, not an exceptional
 * one, and a caller handling untrusted input should not need a try/catch to
 * stay alive. Deterministic: `validate(x)` deep-equals `validate(x)` for every
 * `x`, which is why nothing in this path may read a clock or a random source
 * (SC-008).
 */
export function validate(input: unknown): ValidationResult<LessonManifestOutput> {
  let parsed: ReturnType<typeof lessonManifestSchema.safeParse>
  try {
    parsed = lessonManifestSchema.safeParse(input)
    /* v8 ignore start -- defensive: no constructible input makes safeParse
       throw today, but the never-throws guarantee must not depend on that
       staying true across a Zod upgrade. Deleting the guard to win coverage
       would trade a real guarantee for a number. */
  } catch (cause) {
    return {
      ok: false,
      issues: [
        {
          code: 'TYPE_MISMATCH',
          path: [],
          location: {},
          message: `Input could not be read as a lesson manifest: ${
            cause instanceof Error ? cause.message : 'unknown error'
          }`,
        },
      ],
    }
    /* v8 ignore stop */
  }

  if (!parsed.success) {
    const issues: ValidationIssue[] = parsed.error.issues.flatMap((issue) => mapIssue(issue, input))
    return { ok: false, issues }
  }

  // Tier 2 runs only once the structure is sound.
  const referential = checkReferences(parsed.data)
  if (referential.length > 0) return { ok: false, issues: referential }

  return { ok: true, lesson: parsed.data }
}
