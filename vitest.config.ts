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
