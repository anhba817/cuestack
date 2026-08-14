#!/usr/bin/env node
/**
 * Derive which business rules have rule-named tests, instead of asserting a count
 * in prose.
 *
 * This exists because the hand-maintained tally was wrong four times across
 * features 001 and 002 — and twice, the error was introduced while correcting the
 * previous one. A number restated across a spec, a plan, and a quickstart has three
 * chances to drift and no mechanism to notice. Reading the filesystem has none.
 *
 * The scope below is the claim under review: which rules are asserted to have
 * coverage in the codebase as it stands. Adding a rule file without updating the
 * scope fails, and so does the reverse.
 */
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Business rules with subject matter in the codebase today, and where each lives.
 *
 * The remaining rules have no code to test yet:
 *   BR-008, BR-009  publishing and immutable versions   — Wave 5
 *   BR-012          accessibility policy enforcement    — organisation policy, Wave 5
 *   BR-014          autoplay gesture                    — Wave 3
 *   BR-015          reduced-motion substitution          — Wave 3
 *   BR-016          Simple Sequence resolution           — Wave 4
 *   BR-017          duration reduced below event end     — Wave 4 editor warning
 *   BR-018          published asset references           — Wave 5
 */
const EXPECTED = {
  'BR-001': 'schema',
  'BR-002': 'core',
  'BR-003': 'core',
  'BR-004': 'core',
  'BR-005': 'core',
  'BR-006': 'core',
  'BR-007': 'core',
  'BR-010': 'core',
  'BR-011': 'core',
  'BR-013': 'core',
}

function rulesIn(pkg) {
  const dir = join(root, 'packages', pkg, 'test', 'rules')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /^BR-\d+\.test\.ts$/.test(f))
    .map((f) => f.replace('.test.ts', ''))
}

const found = new Map()
for (const pkg of ['schema', 'core', 'react', 'element']) {
  for (const rule of rulesIn(pkg)) {
    // A rule may legitimately be covered in more than one package — BR-001 is a
    // storage rule in schema and would be a timing rule if core enforced it too.
    if (!found.has(rule)) found.set(rule, [])
    found.get(rule).push(pkg)
  }
}

const problems = []

for (const [rule, pkg] of Object.entries(EXPECTED)) {
  const where = found.get(rule)
  if (!where) {
    problems.push(`${rule} is declared in scope but no packages/*/test/rules/${rule}.test.ts exists`)
  } else if (!where.includes(pkg)) {
    problems.push(`${rule} is declared to live in ${pkg} but was found in ${where.join(', ')}`)
  }
}

for (const [rule, where] of found) {
  if (!(rule in EXPECTED)) {
    problems.push(
      `${rule} has a test in ${where.join(', ')} but is not declared in scope — ` +
        'add it here so the count stays derived rather than accidental',
    )
  }
}

if (problems.length > 0) {
  console.error('check-rule-coverage: the declared rule scope and the filesystem disagree.\n')
  for (const p of problems) console.error(`  - ${p}`)
  console.error(
    '\nFix whichever is wrong. This check exists because the hand-maintained count\n' +
      'was wrong four times, twice while correcting itself.',
  )
  process.exit(1)
}

const total = 18
console.log(
  `check-rule-coverage: ok — ${found.size} of ${total} business rules have rule-named tests ` +
    `(${[...found.keys()].sort().join(', ')})`,
)
console.log(`  The other ${total - found.size} have no code to test yet; see EXPECTED for which wave supplies each.`)
