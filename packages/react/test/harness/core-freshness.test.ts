import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `@cuestack/core` resolves to `dist`, so this package tests the **built** kernel.
 *
 * That is correct — it is what a consumer gets — and it has a trap: edit `core/src`, run the
 * React suite, and you are testing the previous build. It cost an hour once, on a change
 * where the symptom was a subscriber that appeared never to fire, because the module being
 * executed genuinely did not contain it.
 *
 * A timestamp comparison is crude and catches exactly the case that matters: source newer
 * than output. It cannot be a lint rule or a type error, because nothing about the code is
 * wrong — only its age.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const CORE = join(HERE, '..', '..', '..', 'core')

function newestMtime(dir: string, match: RegExp): number {
  return readdirSync(dir).reduce((newest, name) => {
    const full = join(dir, name)
    const stats = statSync(full)
    if (stats.isDirectory()) return Math.max(newest, newestMtime(full, match))
    return match.test(name) ? Math.max(newest, stats.mtimeMs) : newest
  }, 0)
}

describe('the built kernel this package tests against', () => {
  it('exists', () => {
    expect(() => readFileSync(join(CORE, 'dist', 'index.js'), 'utf8')).not.toThrow()
  })

  it('is at least as new as the kernel source', () => {
    const source = newestMtime(join(CORE, 'src'), /\.ts$/)
    const built = newestMtime(join(CORE, 'dist'), /\.js$/)
    expect(
      built,
      'packages/core/src is newer than packages/core/dist — run `pnpm build` before the ' +
        'React suite, or you are testing the previous kernel',
    ).toBeGreaterThanOrEqual(source)
  })
})
