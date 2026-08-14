#!/usr/bin/env node
/**
 * Performance gate.
 *
 * Wave 1 arms the resolution budget: a 300-element slide must resolve inside 10ms,
 * which is the kernel's share of NFR-PERF-003's 100ms seek budget. The remaining
 * playback-frame budgets (60fps target, 30fps floor) stay deferred to Wave 3,
 * because there are no frames yet to drop.
 *
 * Runs the perf suite rather than reimplementing the measurement: one definition
 * of the budget, in the tests, where it can be read alongside what it protects.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

try {
  execFileSync('pnpm', ['exec', 'vitest', 'run', '--project', '@cuestack/core', 'perf'], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
  })
  console.log('gate:perf — resolution budget met (300 elements < 10ms, growth linear).')
  console.log('  Playback-frame budgets remain deferred: Wave 3 (QA-4), when there are frames.')
} catch (error) {
  console.error('gate:perf — FAILED. Resolution exceeded its budget or stopped scaling linearly.')
  console.error(`${error.stdout ?? ''}${error.stderr ?? ''}`)
  process.exit(1)
}
