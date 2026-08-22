import { defineConfig } from 'vitest/config'

/**
 * The gate negative controls, and nothing else.
 *
 * **Why these are not in the ordinary suite.** `check-gates.test.ts` proves each gate fails when it
 * should, and it does that the only way that means anything: by running the real gate scripts as
 * subprocesses. It invokes `gates/perf.mjs` four times and `gates/run-all.mjs` once, and three of
 * those invocations expect the whole gate to *succeed* — which measures every performance budget.
 *
 * Inside `pnpm test` that is a disaster twice over. It re-measures every budget while a dozen
 * suites compete for the same cores, which is the exact condition feature 013 exists to remove —
 * so excluding the performance files from the workspace projects would have achieved nothing while
 * looking like it had. And it dominated the runtime: the gates project alone accounted for 69.8s
 * of a 77s suite, so `pnpm test` was ten parts gate to one part test.
 *
 * **It was found late, and only by running things.** Six analysis passes missed it because they
 * searched `tools/scripts/__tests__/` and this file sits one directory up.
 *
 * Run by `pnpm test:gates` and by CI's "gates fail when they should" job. Not by `pnpm test`.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'gate-controls',
          // Deliberately one file. Anything added here spawns gates, and anything that spawns
          // gates does not belong in a suite people run while they work.
          include: ['tools/scripts/check-gates.test.ts'],
          // Each control runs one or more gates end to end.
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
})
