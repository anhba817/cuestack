import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/server.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  fixedExtension: false,
  // TODO(T069/T073): the stylesheet must ship and be importable as
  // '@cuestack/react/styles.css'. The copy works and dist/styles.css is produced, but
  // neither publint nor Turbopack resolves the subpath export from the workspace link,
  // so the export declaration is withheld until that is understood. Declaring an
  // export that does not resolve is worse than not declaring it yet.
  copy: [{ from: 'src/styles/styles.css', to: 'dist/styles.css' }],
})
