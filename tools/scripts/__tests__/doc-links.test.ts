import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '..', '..', '..')

/**
 * FR-021. A guide that points at a moved file fails in a reader's hands, quietly, weeks later —
 * and the reader concludes the documentation is stale in general rather than in one line.
 *
 * Relative links only: an external URL's liveness is not this repository's to assert, and a test
 * that reached the network would fail on a train.
 */
const LINK = /\[[^\]]*\]\(([^)]+)\)/g

const markdown = (dir: string): string[] =>
  readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(dir, f))

const documents = (): string[] => [
  join(ROOT, 'README.md'),
  ...markdown(join(ROOT, 'docs')),
  ...['core', 'schema', 'react', 'studio', 'adapter-http', 'element']
    .map((p) => join(ROOT, 'packages', p, 'README.md'))
    .filter(existsSync),
]

describe('every relative link in the documentation resolves', () => {
  for (const file of documents()) {
    const relative = file.slice(ROOT.length + 1)

    it(relative, () => {
      const source = readFileSync(file, 'utf8')
      const broken: string[] = []

      for (const [, target] of source.matchAll(LINK)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue
        // A fragment on a relative path points into the file, not at a separate one.
        const path = resolve(dirname(file), target.split('#')[0]!)
        if (!existsSync(path)) broken.push(target)
      }

      expect(broken, `${relative} links to files that do not exist`).toEqual([])
    })
  }
})
