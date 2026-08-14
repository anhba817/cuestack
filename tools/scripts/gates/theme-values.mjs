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
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const target = join(root, 'packages/react/src/elements')

const hasWork = existsSync(target) && readdirSync(target, { recursive: true }).some((f) => String(f).endsWith('.tsx'))

if (!hasWork) {
  console.log('gate:theme-values — no element renderers yet; nothing to check.')
  process.exit(0)
}

try {
  execFileSync('pnpm', ['exec', 'eslint', 'packages/react/src/elements'], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
  })
  console.log('gate:theme-values — ok, no colour/typography/spacing literals in element renderers.')
} catch (error) {
  console.error('gate:theme-values — FAILED. A renderer contains a style literal.')
  console.error('  All visual values must resolve from var(--cs-theme-*) with a readable fallback.')
  console.error(`${error.stdout ?? ''}${error.stderr ?? ''}`)
  process.exit(1)
}
