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
      // Node-environment packages. react is registered separately below with a DOM.
      'packages/{schema,core,element}',
      // The React adapter needs a DOM. happy-dom over jsdom for speed, since the
      // suite has to stay fast enough that nobody is tempted to skip it.
      {
        test: {
          name: '@cuestack/react',
          root: './packages/react',
          environment: 'happy-dom',
          include: ['test/**/*.test.{ts,tsx}'],
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
          exclude: ['test/geometry/**', 'test/draft/**', '**/*.pure.test.{ts,tsx}'],
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
      // The gate negative-controls live with the scripts they exercise.
      {
        test: {
          name: 'gates',
          include: ['tools/scripts/**/*.test.ts'],
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
