import shared from './tools/eslint-config/index.js'

export default [
  ...shared,
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
