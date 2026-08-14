import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * Shared flat config for the Cuestack workspace.
 *
 * Per-file rules live here. Graph-level rules — "core must not import React",
 * "no cycles" — are dependency-cruiser's job, because a lint rule sees one file at
 * a time and cannot detect a cycle that passes through three packages.
 * See specs/001-framework-foundation/research.md R-03.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.next/**',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Constitution I: no `any` in an exported signature.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Constitution I: bare @ts-ignore is banned; @ts-expect-error needs a reason.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' },
      ],
    },
  },
  {
    // Determinism: SC-008 requires validate(x) to deep-equal validate(x).
    // The realistic way that breaks is an error message interpolating a
    // timestamp, or a migration stamping updatedAt — both look harmless in
    // review. research.md R-07.
    files: ['packages/schema/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Schema validation must be deterministic (SC-008). No clock reads.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Schema validation must be deterministic (SC-008).' },
        { object: 'Math', property: 'random', message: 'Schema validation must be deterministic (SC-008).' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Schema validation must be deterministic (SC-008). No clock reads.',
        },
      ],
    },
  },
  {
    /**
     * Constitution I: @cuestack/core must not import a UI framework.
     *
     * This lives in ESLint, not dependency-cruiser, for a reason worth writing
     * down. Under pnpm's isolated node_modules, `react` is not resolvable from
     * packages/core at all — so a resolver-based tool records no edge and the
     * graph rule is blind to precisely the import it exists to forbid. A
     * syntactic rule sees the specifier whether or not it resolves.
     *
     * dependency-cruiser still owns cycles and cross-package direction, which
     * DO resolve (via workspace links) and which ESLint cannot see.
     */
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'vue', 'vue/*', 'svelte', 'svelte/*', 'preact', 'preact/*', 'solid-js', 'solid-js/*'],
              message:
                'no-ui-in-core: @cuestack/core must not import a UI framework. The kernel is what makes every adapter possible; the moment React leaks into it, the Vue and web-component adapters stop being thin bindings and start being rewrites. (Constitution I)',
            },
            {
              group: ['@cuestack/react', '@cuestack/element', '@cuestack/react/*', '@cuestack/element/*'],
              message:
                'no-adapters-in-core: @cuestack/core must not import an adapter. The arrow points the other way.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/schema/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@cuestack/core', '@cuestack/react', '@cuestack/element', '@cuestack/*/dist/*'],
              message:
                'no-core-in-schema: dependencies flow schema <- core <- adapters, one direction only. @cuestack/schema is the format contract and must not depend on anything that consumes it.',
            },
          ],
        },
      ],
    },
  },
  {
    // dependency-cruiser's config is CommonJS by design — it is loaded by a tool
    // that predates ESM config support.
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    // Build and check scripts run in Node, not a browser or a bundle.
    files: ['tools/**/*.{js,mjs}', '*.config.{js,mjs,ts}', '**/*.config.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.test.ts', '**/test/**/*.ts', 'tools/**/*.{js,mjs,ts}'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
