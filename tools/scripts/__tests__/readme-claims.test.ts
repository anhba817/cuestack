import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The numbers the front page states about the test suite are true.
 *
 * **Because the last two of them were not.** The README claimed `pnpm test (189 tests)` running in
 * `< 1 s`, against a real 2900 tests in 77 seconds — a count wrong by an order of magnitude and a
 * duration wrong by two, sitting in the same table as the build-timing budget. Feature 013 corrected
 * both, and correcting a number by hand makes it stale at the next commit: the figure moved from
 * 2899 to 2900 between that feature's spec being written and its analysis being run.
 *
 * So the numbers are checked rather than maintained. What is checkable cheaply and exactly is
 * asserted here; what is not, the README does not state.
 */

const ROOT = resolve(import.meta.dirname, '..', '..', '..')
const README = readFileSync(join(ROOT, 'README.md'), 'utf8')

/** Files a config collects, asked of the runner rather than derived from a glob. */
function fileCount(config: string): number {
  const out = execFileSync('pnpm', ['exec', 'vitest', 'list', '--filesOnly', '-c', config], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  const paths = out
    .split('\n')
    .map((line) => /^\[[^\]]*\]\s*(.*)$/.exec(line.trim())?.[1] ?? line.trim())
    .filter((line) => /\.test\.tsx?$/.test(line))
  return new Set(paths).size
}

const claim = (pattern: RegExp): number => {
  const found = pattern.exec(README)
  expect(found, `README no longer states a number matching ${pattern}`).not.toBeNull()
  return Number(found![1]!.replace(/,/g, ''))
}

describe('the front page states true numbers about the suite', () => {
  it('the test-file count matches what `pnpm test` actually collects', () => {
    const actual = fileCount('vitest.config.ts')
    expect(claim(/pnpm test\s+# behaviour: ([\d,]+) test files/)).toBe(actual)
    expect(claim(/`pnpm test` \(([\d,]+) test files/)).toBe(actual)
  })

  it('the budget count matches the measurements the perf suites emit', () => {
    /**
     * Counted from source rather than by running the gate. **The ordinary suite must not spawn
     * gates** — that is the invariant `perf-ownership.test.ts` enforces and the reason this suite
     * dropped from 77s to 10s. One `perf:` line per budget is the contract `gates/perf.mjs` parses.
     */
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : walk(full)
        return /\.test\.tsx?$/.test(name) ? [full] : []
      })
    const sites = walk(join(ROOT, 'packages'))
      .filter((f) => f.split('/').includes('perf') || /(^|\/)perf\.test\.tsx?$/.test(f))
      .reduce((n, f) => n + (readFileSync(f, 'utf8').match(/console\.log\(`perf:/g)?.length ?? 0), 0)
    expect(claim(/`pnpm gates` \(([\d,]+) measured budgets/)).toBe(sites)
  })

  it('the package count matches what the gate spawns', () => {
    const source = readFileSync(join(ROOT, 'tools/scripts/gates/perf.mjs'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    const packages = new Set([...source.matchAll(/\brun\('(@cuestack\/[a-z-]+)'\)/g)].map((m) => m[1]))
    expect(claim(/measured budgets, ([\d,]+) packages\)/)).toBe(packages.size)
  })

  it('states no test count it cannot check', () => {
    // A total test count needs a run to establish, and a number nobody can check is the class of
    // claim this file exists to retire. If the README starts stating one, this fails.
    const table = /\| `pnpm test`[^\n]*\n/.exec(README)?.[0] ?? ''
    expect(table).not.toMatch(/\b\d{3,}\s+tests\b/)
  })
})
