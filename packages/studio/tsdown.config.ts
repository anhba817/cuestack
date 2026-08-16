import { defineConfig } from 'tsdown'

/**
 * One entry, and deliberately no `react-server` condition.
 *
 * `@cuestack/react` has one because a lesson's first frame is server-rendered. Authoring
 * is not: a teacher is always in a browser, and every entry point here uses hooks.
 * Advertising an RSC path that cannot work is the mirror of the mistake feature 003 made
 * in the other direction, where the static player used a hook and could not be a Server
 * Component. See contracts/studio-package-api.md.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  fixedExtension: false,
})
