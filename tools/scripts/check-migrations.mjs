#!/usr/bin/env node
/**
 * FR-018 / SC-006: a change to the lesson format must ship its migration step in
 * the same revision.
 *
 * Constitution I states this as a rule; without a gate it is a rule people
 * remember until the week they are busy. The failure mode it prevents is not
 * hypothetical — a format change that lands without a migration is invisible
 * until someone opens a lesson authored before it, by which time the change is
 * several releases deep.
 */
import { execFileSync } from 'node:child_process'

const BASE = process.env.BASE_REF ?? 'origin/main'
const SCHEMA_DEFINITION = 'packages/schema/src/validate/'
const MIGRATION_STEPS = 'packages/schema/src/migrate/steps/'

function changedFiles() {
  try {
    // Compare against the merge base so a stale branch does not report the
    // whole of main as its own work.
    const mergeBase = execFileSync('git', ['merge-base', 'HEAD', BASE], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return execFileSync('git', ['diff', '--name-only', `${mergeBase}...HEAD`], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
  } catch {
    console.log(`check-migrations: no ${BASE} to compare against — skipping.`)
    console.log('  (This is expected on a fresh clone with no remote; CI always has one.)')
    return null
  }
}

const changed = changedFiles()
if (changed === null) process.exit(0)

const touchedFormat = changed.filter((f) => f.startsWith(SCHEMA_DEFINITION))
const addedMigration = changed.some((f) => f.startsWith(MIGRATION_STEPS))

if (touchedFormat.length > 0 && !addedMigration) {
  console.error('check-migrations: the lesson format changed without a migration step.\n')
  console.error('  Changed format definition files:')
  for (const file of touchedFormat) console.error(`    - ${file}`)
  console.error(`\n  Required: a step under ${MIGRATION_STEPS} in the same change.`)
  console.error(
    '\n  Every version change ships a migration, including the no-op ones: gap detection\n' +
      '  depends on the chain staying contiguous. If this change genuinely does not alter\n' +
      '  the format (a comment, a message reword), say so in review — do not silence the gate.',
  )
  process.exit(1)
}

console.log(
  touchedFormat.length > 0
    ? `check-migrations: ok — format changed in ${touchedFormat.length} file(s), migration step present`
    : 'check-migrations: ok — format definition untouched',
)
