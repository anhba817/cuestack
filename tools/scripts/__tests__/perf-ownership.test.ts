import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The performance files are measured in exactly one place, and something checks that.
 *
 * **This is the file the feature's risk sits on.** Performance suites were removed from the default
 * suite on the promise that another mechanism runs them. Every way that promise can break leaves
 * the board green: a package gains perf files nobody adds to the gate, a file is renamed out of its
 * include pattern, a project is dropped from the performance config while staying excluded from the
 * ordinary one. After the split, a relocated budget and a deleted one are indistinguishable.
 *
 * The repository has had this exact failure before — three gates carrying package lists that
 * reached nothing, and a public-surface check that ran in one direction for five waves.
 *
 * **It asks the runner rather than reimplementing it.** `vitest list --filesOnly` reports what each
 * config actually collects, which is the only answer that cannot drift from what actually runs. A
 * regex over the config files would be a second implementation of glob resolution, and the whole
 * point here is that a second implementation of anything is what goes stale.
 */

const ROOT = resolve(import.meta.dirname, '..', '..', '..')

/** Every file either config collects, as repo-relative paths. */
function collected(config: string): string[] {
  const out = execFileSync(
    'pnpm',
    ['exec', 'vitest', 'list', '--filesOnly', '-c', config],
    { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
  )
  // `vitest list` prefixes each path with its project: `[@cuestack/core] packages/core/...`.
  // A file in two projects would be listed twice, which is itself worth not silently collapsing
  // — but the set is what these assertions compare, so it is deduplicated here.
  const paths = out
    .split('\n')
    .map((line) => line.trim())
    .map((line) => /^\[[^\]]*\]\s*(.*)$/.exec(line)?.[1] ?? line)
    .filter((line) => /\.test\.tsx?$/.test(line))
    .map((line) => relative(ROOT, resolve(ROOT, line)))
  return [...new Set(paths)].sort()
}

/**
 * What a performance file *is*, decided by looking at the tree rather than at either config.
 *
 * A `perf` path segment or a `perf.` filename. Both shapes exist — `test/perf/frame.test.ts` and
 * `test/perf.test.ts` — and so does a third that neither pattern would have caught:
 * `packages/core/test/resolve/perf.test.ts`, which was missing from this feature's own inventory
 * until the artifacts were checked against disk.
 */
function performanceFilesOnDisk(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : walk(full)
      return /\.test\.tsx?$/.test(name) ? [full] : []
    })
  return walk(join(ROOT, 'packages'))
    .map((f) => relative(ROOT, f))
    .filter((f) => f.split('/').includes('perf') || /(^|\/)perf\.test\.tsx?$/.test(f))
    // `check-gates.test.ts` writes probe files into these directories and removes them again.
    // They are a gate control's scaffolding, not a budget, and a run that caught one mid-flight
    // would fail for a reason that is nobody's defect.
    .filter((f) => !f.includes('__gate_probe__'))
    .sort()
}

/**
 * The packages `gates/perf.mjs` actually spawns.
 *
 * **Comments stripped first.** A commented-out `run()` is the shape of the failure this whole file
 * exists for — a gate whose package list reaches nothing, which this repository has shipped three
 * times. Reading source text cannot distinguish a call from a mention, and stripping comments
 * removes the case that has actually happened.
 */
function packagesInTheGate(): string[] {
  const source = readFileSync(join(ROOT, 'tools', 'scripts', 'gates', 'perf.mjs'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  return [...source.matchAll(/\brun\('(@cuestack\/[a-z-]+)'\)/g)].map((m) => m[1]!).sort()
}

/** The projects `vitest.perf.config.ts` declares. */
function projectsInThePerfConfig(): string[] {
  const source = readFileSync(join(ROOT, 'vitest.perf.config.ts'), 'utf8')
  return [...source.matchAll(/name: '(@cuestack\/[a-z-]+)'/g)].map((m) => m[1]!).sort()
}

describe('every performance budget is measured in exactly one place', () => {
  const perf = collected('vitest.perf.config.ts')
  const ordinary = collected('vitest.config.ts')
  const onDisk = performanceFilesOnDisk()

  it('finds performance files at all, so this suite cannot pass by finding nothing', () => {
    // The failure mode this whole file is about, applied to itself.
    expect(onDisk.length).toBeGreaterThan(0)
    expect(perf.length).toBeGreaterThan(0)
  })

  it('the performance config collects every performance file on disk', () => {
    expect(perf).toEqual(onDisk)
  })

  it('the ordinary suite collects none of them', () => {
    // The rename drift: a perf file that slips out of its excluded pattern runs in both places
    // again, and the flake it caused comes back.
    expect(ordinary.filter((f) => onDisk.includes(f))).toEqual([])
  })

  it('no performance file has fallen out of both', () => {
    // The silent deletion: dropped from the performance config, still excluded from the ordinary
    // one, running nowhere, every board green.
    expect(onDisk.filter((f) => !perf.includes(f) && !ordinary.includes(f))).toEqual([])
  })

  it('the gate runs exactly the packages the performance config declares', () => {
    expect(packagesInTheGate()).toEqual(projectsInThePerfConfig())
  })

  it('every package the gate names has files to run', () => {
    const empty = projectsInThePerfConfig().filter(
      (name) => !perf.some((f) => f.startsWith(`packages/${name.replace('@cuestack/', '')}/`)),
    )
    expect(empty).toEqual([])
  })
})

describe('nothing outside the performance config asserts a duration', () => {
  /**
   * **FR-011a.** The move is defined by where a file lives; the flake is caused by what a file
   * asserts. Two files asserted wall-clock durations from outside any `perf` path — one of them at
   * 20ms — and a one-time sweep finds today's and nothing stops tomorrow's.
   *
   * Deliberately narrow. The neighbouring check in `packages/core/test/harness/duration.test.ts`
   * forbids a test that *waits*, for one package, and widening its regex repo-wide produces sixteen
   * hits that are mostly legitimate async flushes. A check that cries wolf is a check somebody
   * turns off. This rule reproduces the manual sweep exactly instead of approximating it.
   */
  const WALL_CLOCK = /performance\.now\(\)|process\.hrtime/
  const UPPER_BOUND = /toBeLessThan(OrEqual)?\(/

  /**
   * Files whose ceilings are guards rather than budgets, each kept on measured grounds.
   *
   * **An explicit list rather than a comment marker, deliberately.** Feature 003 found the theme
   * gate silenceable by an inline comment three tasks after arming it. An exemption that lives in
   * the checking file has to be edited to be granted, is visible in one place, and carries its
   * evidence next to it — a lint-disable has none of those properties.
   *
   * The evidence is the same for both: ten full-suite runs under deliberate CPU contention, in
   * which the studio timeline failed three times, schema's scaling ratio twice and the element
   * frame budget once. Neither of these failed once. Six further isolated runs under the same
   * load, six passes.
   */
  const GUARDS: ReadonlyArray<readonly [string, string]> = [
    [
      'packages/react/test/ssr/timing.test.ts',
      '2000ms server-render ceilings against a render that takes about 2ms; best-of-five sampling.',
    ],
    [
      'packages/schema/test/pathological.test.ts',
      '2000ms and 10000ms termination guards against a validation that takes about 0.5ms.',
    ],
  ]

  it('no test outside it pairs a wall-clock read with an upper-bound assertion', () => {
    const perfFiles = new Set(performanceFilesOnDisk())
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : walk(full)
        return /\.test\.tsx?$/.test(name) ? [full] : []
      })
    const offenders = walk(join(ROOT, 'packages'))
      .map((f) => relative(ROOT, f))
      .filter((f) => !perfFiles.has(f))
      .filter((f) => !GUARDS.some(([path]) => path === f))
      .filter((f) => {
        const body = readFileSync(join(ROOT, f), 'utf8')
        return WALL_CLOCK.test(body) && UPPER_BOUND.test(body)
      })
    expect(offenders).toEqual([])
  })

  it('every exempted guard still exists, so an exemption cannot outlive its file', () => {
    // A rename that left the entry behind would carry the exemption to whatever took the name.
    expect(GUARDS.filter(([path]) => !existsSync(join(ROOT, path)))).toEqual([])
  })
})


describe('the ordinary suite does not run gates', () => {
  /**
   * **The hole that six analysis passes missed, and the assertion that closes it.**
   *
   * `tools/scripts/check-gates.test.ts` proves each gate fails when it should, by running the real
   * gate scripts. It invoked `gates/perf.mjs` four times and `run-all.mjs` once on every
   * `pnpm test` — three of them expecting the gate to *succeed*, which measures every performance
   * budget. So the ordinary suite re-measured every budget under exactly the contention this
   * feature removes, by a path no exclusion of test files reaches. It also cost 69.8s of a 77s
   * suite.
   *
   * It now lives in `vitest.gates.config.ts`. Nothing stops someone moving it back, or adding a
   * second file that spawns a gate, except this.
   */
  it('no file it collects executes a gate script', () => {
    /**
     * **A mention is not an execution, and neither is a read.** This assertion has now been wrong
     * twice in the same way. Its first draft matched any occurrence of `gates/*.mjs` and reported
     * *this file*, which names the gate in its own prose. Its second still matched
     * `readme-claims.test.ts`, which legitimately reads `perf.mjs` to count the packages it
     * spawns. Both are the same error the repository has made four times before: a regex over
     * source text that cannot tell code from commentary, or reading from running.
     *
     * What is actually forbidden is *spawning* a gate — a child-process call whose argument list
     * names one. That is what re-measures every budget under contention.
     */
    const code = (body: string): string =>
      body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    const SPAWNS_A_GATE = /['"`]node['"`]\s*,\s*\[\s*['"`]tools\/scripts\/gates\/[a-z-]+\.mjs/
    const offenders = collected('vitest.config.ts').filter((f) =>
      SPAWNS_A_GATE.test(code(readFileSync(join(ROOT, f), 'utf8'))),
    )
    expect(offenders).toEqual([])
  })

  it('the gate controls are collected somewhere, not merely absent', () => {
    // Removing them from `pnpm test` and nowhere else would look identical to this passing.
    expect(collected('vitest.gates.config.ts')).toContain('tools/scripts/check-gates.test.ts')
  })
})
