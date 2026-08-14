import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/server.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  fixedExtension: false,
  // The stylesheet is concatenated rather than copied. `src/styles/styles.css` is two
  // @import statements, and copying only that file left both pointing at files never
  // placed in dist — a published stylesheet that resolved to nothing, silently. See
  // tools/scripts/bundle-css.mjs.
})
