import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/validate/index.ts', 'src/migrate/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  fixedExtension: false,
})
