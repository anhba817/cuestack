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
      'packages/*',
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
      // Widened by US4 (T062-T065), now that migrate/ is real rather than a stub.
      include: ['packages/schema/src/{validate,migrate}/**/*.ts'],
      exclude: ['**/dist/**', '**/*.d.ts', 'packages/schema/src/index.ts', 'packages/schema/src/types/**'],
      // T041: Constitution II's floor for @cuestack/schema. Set here rather
      // than in a later phase because the principle ties the floor to schema's
      // own tests, so it belongs with the story that writes them.
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
        // T053: @cuestack/core is listed but not enforced. It ships as an empty
        // stub in Wave 0 — a coverage gate over a package with no statements
        // either passes vacuously or divides by zero, and neither carries
        // information. Wave 1 (EN-1) fills the package and enables this line.
        // 'packages/core/src/**/*.ts': { lines: 90, branches: 90 },
      },
    },
  },
})
