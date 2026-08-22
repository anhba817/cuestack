import shared from './tools/eslint-config/index.js'

export default [
  ...shared,
  {
    /**
     * The browser check's drivers contain browser code.
     *
     * `page.evaluate` and `addInitScript` bodies are serialised and run inside the engine, so
     * `document`, `window`, `requestAnimationFrame` and `MutationObserver` are exactly the right
     * globals there — and exactly the wrong ones anywhere else in this repository, which is why the
     * allowance is scoped to these two files rather than added to the shared config.
     */
    files: ['tools/browser/*.mjs'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        MutationObserver: 'readonly',
        customElements: 'readonly',
        matchMedia: 'readonly',
        fetch: 'readonly',
      },
    },
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.turbo/**',
      'tools/scripts/gate-fixtures/**',
    ],
  },
]
