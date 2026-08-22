import { defineConfig } from 'vitest/config'

/**
 * The performance suites, and nothing else.
 *
 * **Why a second config rather than an exclusion.** Every budget used to be measured twice: the
 * workspace projects glob `test/**`, which swallows `test/perf/**`, and `gates/perf.mjs` then
 * spawned vitest again per package to run the same files alone. The two runs disagreed — one
 * measured the code, the other measured a dozen suites competing for the same cores — so the
 * obvious fix was to exclude the performance files from the workspace projects.
 *
 * That does not work. `gates/perf.mjs` reaches these files through `--project <name>`, and
 * `--project` selects a project whose own include/exclude decides its file set. Exclude them there
 * and the gate collects nothing, exits 1, and reports a budget breach for a file it never opened:
 *
 *     $ vitest run --project @cuestack/studio test/perf
 *     No test files found, exiting with code 1
 *
 * So the ownership is expressed as two configs instead. This one collects the performance files for
 * the gate; `vitest.config.ts` excludes exactly these paths for everyone else. Both entry points of
 * the ordinary suite — `pnpm test` and `pnpm test:coverage` — read that one, so the CI job that was
 * failing on timing is covered without touching `package.json`.
 *
 * **The two lists are checked, not trusted.** `tools/scripts/__tests__/perf-ownership.test.ts`
 * compares this file, `vitest.config.ts`, the gate's package list, and the performance files
 * actually on disk. After the exclusion a relocated budget and a deleted one look identical — both
 * leave every board green — and that check is the only thing that tells them apart.
 *
 * **Ten files, and the tenth is why the inventory is written out file by file.**
 * `packages/core/test/resolve/perf.test.ts` carries a 10ms budget, a growth ratio and a 50ms
 * median from outside any `perf` directory, so no directory pattern reaches it. A count derived
 * from the pattern meant to move these files cannot report what that pattern misses.
 *
 * Environments mirror `vitest.config.ts` exactly. A performance suite that ran in the wrong
 * environment would measure something real and irrelevant.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: '@cuestack/core',
          root: './packages/core',
          environment: 'node',
          // test/resolve/perf.test.ts is a file, not a directory: SC-001's resolution budget.
          include: ['test/perf/**/*.test.ts', 'test/resolve/perf.test.ts'],
        },
      },
      {
        test: {
          name: '@cuestack/schema',
          root: './packages/schema',
          environment: 'node',
          // A file rather than a directory, which is exactly why this package was missing from the
          // gate: a pattern written for `test/perf/**` never reached it.
          include: ['test/perf.test.ts'],
        },
      },
      {
        test: {
          name: '@cuestack/element',
          root: './packages/element',
          environment: 'happy-dom',
          include: ['test/perf/**/*.test.ts'],
        },
      },
      {
        test: {
          name: '@cuestack/react',
          root: './packages/react',
          environment: 'happy-dom',
          include: ['test/perf/**/*.test.{ts,tsx}'],
        },
      },
      {
        test: {
          name: '@cuestack/studio',
          root: './packages/studio',
          environment: 'happy-dom',
          include: ['test/perf/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
})
