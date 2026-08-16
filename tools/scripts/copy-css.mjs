#!/usr/bin/env node
/**
 * Publish a package's single stylesheet as `dist/styles.css`.
 *
 * Deliberately not `bundle-css.mjs`. That script exists because the player's stylesheet is
 * an `@import` manifest over four files, and copying only the entry left every import
 * dangling — a published stylesheet that resolved to nothing, silently. `@cuestack/studio`
 * has one stylesheet and no imports, so concatenation would be machinery without a job.
 *
 * The check at the end is the part worth keeping from the other script: an `@import` in the
 * output would dangle exactly the same way, so if this package ever grows a second
 * stylesheet, this fails rather than shipping a file that resolves to nothing.
 *
 * Usage: node tools/scripts/copy-css.mjs <package-dir-name> <source-path-within-package>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const [pkg, source] = process.argv.slice(2)
if (!pkg || !source) {
  console.error('copy-css: usage — copy-css.mjs <package-dir-name> <source-path-within-package>')
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const from = join(root, 'packages', pkg, source)
const css = readFileSync(from, 'utf8')

if (/@import/.test(css)) {
  console.error(
    `copy-css: ${source} contains an @import, which will dangle once copied. Either inline it ` +
      'or concatenate the set the way bundle-css.mjs does for the player.',
  )
  process.exit(1)
}

const banner = `/* @cuestack/${pkg} — generated from ${source}; do not edit. */\n`
const out = join(root, 'packages', pkg, 'dist/styles.css')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${banner}\n${css}`)

console.log(`copy-css: ok — packages/${pkg}/dist/styles.css from ${source}`)
