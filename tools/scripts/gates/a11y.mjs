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

/**
 * Both packages, since feature 007.
 *
 * The gate ran only the player's suite for three features, and that was right: the
 * constitution's CI gate 6 covers *learner-facing* components, and the editor package held
 * none. ED-6 changed that — a preview **is** the player, mounted inside the editor — so the
 * studio's own axe suite is now inside the blocking gate rather than only inside `pnpm test`.
 *
 * The precedent is that gates follow the editor as it grows: `perf.mjs` already runs the
 * studio's perf suite and `theme-values.mjs` already targets `packages/studio/src`. This was
 * the one that had not needed to yet.
 */
const PROJECTS = [
  { project: '@cuestack/react', dir: join(root, 'packages/react/test/a11y'), ext: '.test.ts' },
  { project: '@cuestack/studio', dir: join(root, 'packages/studio/test/a11y'), ext: '.test.tsx' },
]

const present = PROJECTS.filter(
  ({ dir, ext }) => existsSync(dir) && readdirSync(dir).some((f) => f.endsWith(ext)),
)
const hasWork = present.length > 0

if (!hasWork) {
  console.log('gate:a11y — no learner-facing components yet; nothing to check.')
  process.exit(0)
}

try {
  for (const { project } of present) {
    execFileSync('pnpm', ['exec', 'vitest', 'run', '--project', project, 'a11y'], {
      cwd: root,
      stdio: 'pipe',
      encoding: 'utf8',
    })
  }
  const names = present.map((p) => p.project).join(', ')
  console.log(`gate:a11y — ok, no WCAG 2.2 AA violations in ${names}.`)
  console.log('  Covers roughly half of real defects. Screen-reader review is still required.')
  console.log('  Note: the suites run only the WCAG tags, so best-practice rules — the dialog')
  console.log('  accessible-name rule among them — are asserted in the suites themselves.')
} catch (error) {
  console.error('gate:a11y — FAILED. WCAG 2.2 AA violations found.')
  console.error(`${error.stdout ?? ''}${error.stderr ?? ''}`)
  process.exit(1)
}
