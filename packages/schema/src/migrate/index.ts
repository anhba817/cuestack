import { validate } from '../validate/index.js'
import type { ValidationIssue } from '../validate/issues.js'
import type { LessonManifestOutput } from '../validate/lesson.js'
import { resolveChain, currentVersion, supportedVersions } from './chain.js'

export { currentVersion, supportedVersions }
export type { MigrationStep } from './types.js'

export type MigrationResult =
  | { ok: true; manifest: LessonManifestOutput; applied: string[] }
  | { ok: false; issues: ValidationIssue[] }

/**
 * Carry a lesson forward to the current format version.
 *
 * Forward-only, by design and not by omission: a downgrade path would require
 * deciding what to discard, and there is no defensible answer to that question.
 *
 * The input is structurally cloned before any step runs, so the caller's object
 * — which may be the draft a teacher is editing — is never touched.
 */
export function migrate(input: unknown): MigrationResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      issues: [
        {
          code: 'TYPE_MISMATCH',
          path: [],
          location: {},
          message: 'A lesson manifest must be an object.',
        },
      ],
    }
  }

  const declared = (input as Record<string, unknown>)['schemaVersion']
  const chain = resolveChain(declared)
  if (!chain.ok) return { ok: false, issues: chain.issues }

  let working: unknown = structuredClone(input)
  const applied: string[] = []

  for (const step of chain.steps) {
    try {
      working = step.up(working)
    } catch (cause) {
      return {
        ok: false,
        issues: [
          {
            code: 'MIGRATION_STEP_FAILED',
            path: [],
            location: {},
            message: `Migration step ${step.from}->${step.to} failed: ${
              cause instanceof Error ? cause.message : 'unknown error'
            }`,
          },
        ],
      }
    }
    applied.push(`${step.from}->${step.to}`)
  }

  // The result must be a valid current-version manifest, not merely a
  // transformed one. A step that produced something invalid is a defect, and
  // catching it here is cheaper than catching it in a player.
  const result = validate(working)
  if (!result.ok) return { ok: false, issues: result.issues }

  return { ok: true, manifest: result.lesson, applied }
}
