#!/usr/bin/env node
/**
 * Concatenate the player's stylesheets into one published file.
 *
 * `src/styles/styles.css` is two `@import` statements, which is right for reading and
 * wrong for shipping: copying that file alone into `dist` left both imports pointing at
 * files that were never copied, so the published stylesheet resolved to nothing at all.
 * A consumer would have imported it, seen no error, and got an unpositioned stage.
 *
 * Copying all three files would also work and would cost a consumer two extra requests
 * for something with one obvious boundary. Concatenating is the same result in one file,
 * and it makes the `@import` order explicit here rather than implicit in a copy glob.
 *
 * Reset first, deliberately: it is scoped beneath the stage and the stage rules must be
 * able to override it.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const styles = join(root, 'packages/react/src/styles')

const ORDER = ['reset.css', 'stage.css']

/** The entry file must import exactly what is concatenated, in the same order. A file
 *  added to one and not the other is the drift this check exists to stop. */
const entry = readFileSync(join(styles, 'styles.css'), 'utf8')
const imported = [...entry.matchAll(/@import\s+'\.\/([^']+)'/g)].map((m) => m[1])
if (imported.join(',') !== ORDER.join(',')) {
  console.error(
    `bundle-css: styles.css imports [${imported.join(', ')}] but this script bundles ` +
      `[${ORDER.join(', ')}]. Update whichever is wrong — a stylesheet silently missing a ` +
      'file renders an unpositioned stage rather than an error.',
  )
  process.exit(1)
}

const banner =
  '/* @cuestack/react — the player stylesheet. Generated from src/styles/; do not edit.\n' +
  `   Concatenated in order: ${ORDER.join(', ')} */\n`

const bundled = ORDER.map((name) => readFileSync(join(styles, name), 'utf8')).join('\n')

const out = join(root, 'packages/react/dist/styles.css')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${banner}\n${bundled}`)

if (/@import/.test(bundled)) {
  console.error('bundle-css: the bundled output still contains an @import, which will dangle.')
  process.exit(1)
}

console.log(`bundle-css: ok — dist/styles.css from ${ORDER.join(' + ')}`)
