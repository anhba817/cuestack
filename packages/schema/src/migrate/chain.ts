import type { ValidationIssue } from '../validate/issues.js'
import type { MigrationStep } from './types.js'
import { STEPS } from './steps/index.js'

export const currentVersion = '1.0'

export const supportedVersions: readonly string[] = Array.from(
  new Set(STEPS.flatMap((s) => [s.from, s.to])),
).sort()

function issue(code: ValidationIssue['code'], message: string): ValidationIssue {
  return { code, path: ['schemaVersion'], location: { field: 'schemaVersion' }, message }
}

export type ChainResult =
  | { ok: true; steps: MigrationStep[] }
  | { ok: false; issues: ValidationIssue[] }

/**
 * Resolve the path from a declared version to the current one.
 *
 * A gap is refused rather than skipped. Skipping would produce a manifest that
 * looks current and is subtly wrong — the worst possible outcome, because
 * nothing downstream would flag it.
 */
export function resolveChain(
  declared: unknown,
  /**
   * Injectable so a chain gap can be tested. A gap cannot be produced from the
   * real registry — every registered version is reachable, which is the whole
   * point — but the branch must work the day someone lands a step and forgets
   * its predecessor, so it is exercised against a synthetic chain.
   */
  steps: readonly MigrationStep[] = STEPS,
): ChainResult {
  if (typeof declared !== 'string' || declared.length === 0) {
    return {
      ok: false,
      issues: [
        issue(
          'SCHEMA_VERSION_ABSENT',
          'The manifest declares no schemaVersion. A version is never assumed: without one, ' +
            'there is no way to know which rules the document was written against.',
        ),
      ],
    }
  }

  if (declared === currentVersion) return { ok: true, steps: [] }

  const known = Array.from(new Set(steps.flatMap((s) => [s.from, s.to])))
  if (!known.includes(declared)) {
    const newer = compareVersions(declared, currentVersion) > 0
    return {
      ok: false,
      issues: [
        issue(
          'SCHEMA_VERSION_UNSUPPORTED',
          newer
            ? `Manifest declares schemaVersion ${declared}, newer than the supported ${currentVersion}. ` +
              'Reading a newer manifest requires a newer reader; nothing was loaded.'
            : `Manifest declares schemaVersion ${declared}, which this version does not support. ` +
              `Supported: ${known.join(', ')}.`,
        ),
      ],
    }
  }

  const chain: MigrationStep[] = []
  let at = declared
  const guard = new Set<string>()

  while (at !== currentVersion) {
    if (guard.has(at)) {
      return {
        ok: false,
        issues: [issue('MIGRATION_CHAIN_INCOMPLETE', `Migration chain loops at version ${at}.`)],
      }
    }
    guard.add(at)

    const step = steps.find((s) => s.from === at && s.to !== s.from)
    if (!step) {
      return {
        ok: false,
        issues: [
          issue(
            'MIGRATION_CHAIN_INCOMPLETE',
            `No migration step leads from version ${at} toward ${currentVersion}. ` +
              'The chain has a gap; it is refused rather than skipped, because a skipped step ' +
              'produces a manifest that looks current and is quietly wrong.',
          ),
        ],
      }
    }
    chain.push(step)
    at = step.to
  }

  return { ok: true, steps: chain }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da < db ? -1 : 1
  }
  return 0
}
