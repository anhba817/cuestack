#!/usr/bin/env node
/**
 * Theme-value gate — armed in feature 003.
 *
 * Constitution III requires all visual styling to resolve from theme tokens. This
 * was a passing placeholder for two features because there were no element
 * implementations to hard-code a colour in. There are now.
 *
 * Runs the lint rule rather than reimplementing the check, so there is one
 * definition of what a theme literal is.
 *
 * With `--no-inline-config`, which is the difference between this and `pnpm lint`.
 * Delegating to ESLint meant inheriting its escape hatch: an inline eslint-disable above
 * a hard-coded colour silenced the gate as well as the lint run, so the one mechanism
 * meant to be unbypassable was not.
 * Found by the negative control in `check-gates.test.ts`, which asserted the gate
 * caught what lint could be told to ignore, and it did not.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/**
 * Feature 005: the editor's own components join the gate.
 *
 * **What this gate cannot see, stated so nobody assumes otherwise.** It delegates to
 * ESLint, and ESLint does not parse CSS. Colour literals in stylesheets are therefore
 * enforced by convention across the whole project — the player's stylesheets as much as
 * the editor's. Measured at the time of writing: all 46 colour literals under
 * `packages/react/src/styles/` already sit inside a `var(--cs-theme-*, …)` fallback, so
 * the convention holds unenforced and the gap is currently theoretical. Closing it is
 * recorded as a known limitation in specs/005-studio-canvas-inspector/plan.md rather than
 * done here, because it would retrofit a check onto the player inside a feature about the
 * editor.
 */
const targets = ['packages/react/src/elements', 'packages/studio/src', 'packages/element/src']

const present = targets.filter(
  (t) =>
    existsSync(join(root, t)) &&
    readdirSync(join(root, t), { recursive: true }).some((f) => /\.tsx?$/.test(String(f))),
)

if (present.length === 0) {
  console.log('gate:theme-values — no element renderers or editor components yet; nothing to check.')
  process.exit(0)
}

try {
  execFileSync('pnpm', ['exec', 'eslint', '--no-inline-config', ...present], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
  })
  console.log(
    `gate:theme-values — ok, no colour/typography/spacing literals in ${present.join(', ')}. ` +
      'Note: TS/TSX only — CSS files are not parsed by this gate (see the header).',
  )
} catch (error) {
  console.error('gate:theme-values — FAILED. A renderer contains a style literal.')
  console.error('  All visual values must resolve from var(--cs-theme-*) with a readable fallback.')
  console.error(`${error.stdout ?? ''}${error.stderr ?? ''}`)
  process.exit(1)
}
