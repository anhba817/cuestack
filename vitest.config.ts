import { defineConfig } from 'vitest/config'

/**
 * Workspace test configuration.
 *
 * Coverage thresholds are deliberately NOT set here. A 90% floor at this point
 * would fail against a workspace with no tests and break the green baseline that
 * every later gate measures against (T015). Ownership:
 *
 *   - project list          -> T005 (this file, created here)
 *   - @cuestack/schema floor -> T041, once US1's tests exist
 *   - @cuestack/core entry   -> T053, listed but disabled until Wave 1
 *
 * See specs/001-framework-foundation/tasks.md "Single-owner files".
 */
export default defineConfig({
  test: {
    projects: [
      /**
       * Node-environment packages. react is registered separately below with a DOM.
       *
       * **These were one string glob until feature 013**, which resolves with Vitest's default
       * include and no config object of its own — so there was nowhere to put an `exclude`, and
       * the two packages that most needed one were the two behind it. Writing them out changes
       * nothing about what is collected: none of the three has a test file outside `test/`, and
       * there are no `.spec.ts` files in any of them.
       */
      {
        test: {
          name: '@cuestack/schema',
          root: './packages/schema',
          environment: 'node',
          include: ['test/**/*.test.ts'],
          // A file, not a directory — which is why no `test/perf/**` pattern reached it, and why
          // this package's scaling budget was one tidy-up away from never running again.
          exclude: ['test/perf.test.ts'],
        },
      },
      {
        test: {
          name: '@cuestack/core',
          root: './packages/core',
          environment: 'node',
          include: ['test/**/*.test.ts'],
          // Three files, and the third is the one every directory pattern misses:
          // test/resolve/perf.test.ts carries a 10ms budget, a growth ratio and a 50ms median
          // from outside any `perf` directory.
          exclude: ['test/perf/**', 'test/resolve/perf.test.ts'],
        },
      },
      {
        test: {
          name: '@cuestack/adapter-http',
          root: './packages/adapter-http',
          environment: 'node',
          include: ['test/**/*.test.ts'],
        },
      },
      // The React adapter needs a DOM. happy-dom over jsdom for speed, since the
      // suite has to stay fast enough that nobody is tempted to skip it.
      {
        /**
         * A custom element needs a DOM. `@cuestack/element` was in the node glob above while it was
         * a stub with no tests; feature 011 moves it here rather than adding a second registration,
         * which would have put one package in two projects and run its DOM suites where
         * `customElements` does not exist.
         */
        test: {
          name: '@cuestack/element',
          root: './packages/element',
          environment: 'happy-dom',
          include: ['test/**/*.test.ts'],
          // Measured by gates/perf.mjs through vitest.perf.config.ts. See that file for why the
          // ownership is expressed as two configs rather than one exclusion.
          exclude: ['test/perf/**'],
        },
      },
      {
        test: {
          name: '@cuestack/react',
          root: './packages/react',
          environment: 'happy-dom',
          include: ['test/**/*.test.{ts,tsx}'],
          exclude: ['test/perf/**'],
        },
      },
      // The editor's DOM-bound suites. Everything under test/ except the two
      // directories and the one filename pattern the pure project below claims.
      {
        test: {
          name: '@cuestack/studio',
          root: './packages/studio',
          environment: 'happy-dom',
          include: ['test/**/*.test.{ts,tsx}'],
          exclude: ['test/geometry/**', 'test/draft/**', '**/*.pure.test.{ts,tsx}', 'test/perf/**'],
        },
      },
      /**
       * The editor's pure suites, in an environment with no `document` at all.
       *
       * Not a preference. happy-dom computes no layout: a `<div>` with an explicit
       * `width: 800px` reports a bounding rect of zero. So drag logic that derives
       * geometry from a measured rect is not merely impure, it is untestable — it would
       * arrive either mocking a layout engine or with no tests. Splitting at the
       * logical/screen boundary makes the interesting half testable with no browser, and
       * running it here is what keeps that true: a geometry test that starts reaching for
       * the DOM fails to run rather than quietly growing the dependency (research R-04).
       *
       * `*.pure.test.ts` extends the same guarantee by filename, because purity is a
       * property of a module rather than of a directory — `session/` holds both a React
       * hook that needs a DOM and the selection algebra that must not.
       */
      {
        test: {
          name: '@cuestack/studio-pure',
          root: './packages/studio',
          environment: 'node',
          include: ['test/{geometry,draft}/**/*.test.ts', 'test/**/*.pure.test.ts'],
        },
      },
      /**
       * Checks *about* the repository — documentation links, quoted snippets, plan coverage,
       * README claims, and which mechanism owns which performance budget. They read files.
       *
       * **The gate negative controls are deliberately not here.** `tools/scripts/check-gates.test.ts`
       * proves each gate fails when it should by running the real gate scripts, which means it
       * invoked `gates/perf.mjs` four times and `run-all.mjs` once on every `pnpm test` — three of
       * them expecting success, so every performance budget was measured again under exactly the
       * contention feature 013 exists to remove. It also cost 69.8s of a 77s suite. It lives in
       * `vitest.gates.config.ts` and runs under `pnpm test:gates`.
       */
      {
        test: {
          name: 'gates',
          include: ['tools/scripts/__tests__/**/*.test.ts'],
          testTimeout: 120_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'packages/schema/src/{validate,migrate}/**/*.ts',
        // Feature 002 T034: enabled now that @cuestack/core has statements to
        // cover, closing the deviation feature 001 documented. Scoped to the
        // modules US1 delivered; US2-US5 widen it to 'packages/core/src/**' as
        // each lands, exactly as US4 widened schema's scope to include migrate/.
        'packages/core/src/{resolve,effects,time,advance}/**/*.ts',
        // Feature 010 T002: packaging joins the floor with the story that writes it, the same way
        // resolve/ did in feature 002 and migrate/ did in 001. The scope has been widened once per
        // feature by design — its own note above says so — and this is that widening. What it does
        // NOT do is sweep in validation/, publishing/, and elements/, which features 009 left
        // outside: closing those is a decision somebody should make deliberately, not a side effect
        // of an unrelated diff.
        'packages/core/src/packaging/**/*.ts',
        // Feature 003 T078: the adapter joins the floor now that it has behaviour to
        // cover. Components are included, not excluded as "hard to cover" — a renderer
        // with no test is a renderer nobody has seen output from.
        'packages/react/src/**/*.{ts,tsx}',
        // Feature 005 T004: the editor is reported but carries no numeric floor.
        // Constitution II gives UI packages behavioural tests instead of a coverage
        // number, which is why the thresholds below stay scoped to core and schema.
        'packages/studio/src/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/dist/**',
        '**/*.d.ts',
        'packages/schema/src/index.ts',
        'packages/schema/src/types/**',
        'packages/core/src/index.ts',
        // element.ts's remaining branches are the unknown-type and plugin paths,
        // which serve FR-027/028/029 — US4's requirements and US4's tests. It
        // returns to the floor when US4 lands, alongside the rest of core/src.
        'packages/core/src/resolve/element.ts',
        // Entry points: re-export lists with no statements of their own.
        'packages/react/src/index.ts',
        'packages/react/src/server.ts',
        'packages/react/src/elements/builtin/index.ts',
        // Entry point: a re-export list with no statements of its own, like the two above.
        'packages/studio/src/index.ts',
        // Real browser ports. Exercised by the example app and by any host, and coverable
        // here only by asserting that happy-dom's `document` behaves like a browser's —
        // which would test happy-dom. The substitutability this file exists to serve is
        // itself covered: every playback test supplies its own ports.
        'packages/react/src/player/browserPorts.ts',
      ],
      // T041: Constitution II's floor for @cuestack/schema. Set here rather
      // than in a later phase because the principle ties the floor to schema's
      // own tests, so it belongs with the story that writes them.
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
})
