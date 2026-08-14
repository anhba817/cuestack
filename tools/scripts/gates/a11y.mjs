#!/usr/bin/env node
/**
 * Accessibility gate — armed in feature 003.
 *
 * Constitution III makes WCAG 2.2 AA a merge gate for learner-facing UI. This was a
 * passing placeholder for two features because there were no learner-facing
 * components. There are now.
 *
 * What this does NOT prove: automated checking catches roughly half of real
 * accessibility defects (research R-05). The half it catches is the half that
 * regresses silently — a missing accessible name is invisible when you can see the
 * screen. Keyboard reachability is asserted separately, because axe cannot tell
 * whether a focus order makes sense, and neither substitutes for using the player
 * with a screen reader.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const dir = join(root, 'packages/react/test/a11y')
const hasWork = existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.test.ts'))

if (!hasWork) {
  console.log('gate:a11y — no learner-facing components yet; nothing to check.')
  process.exit(0)
}

try {
  execFileSync('pnpm', ['exec', 'vitest', 'run', '--project', '@cuestack/react', 'a11y'], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
  })
  console.log('gate:a11y — ok, no WCAG 2.2 AA violations on any corpus slide.')
  console.log('  Covers roughly half of real defects. Screen-reader review is still required.')
} catch (error) {
  console.error('gate:a11y — FAILED. WCAG 2.2 AA violations found.')
  console.error(`${error.stdout ?? ''}${error.stderr ?? ''}`)
  process.exit(1)
}
