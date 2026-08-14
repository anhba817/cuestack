#!/usr/bin/env node
/**
 * SC-007 / US2 #3: `@cuestack/core` loads in an environment with no UI
 * framework installed.
 *
 * The dependency-cruiser rule proves core does not *import* React. This proves
 * the stronger, consumer-facing claim: pack the tarball, install it alone into
 * an empty directory with nothing else present, and import it. A transitive
 * dependency that dragged React in would pass the lint rule and fail here.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const coreDir = join(root, 'packages/core')
const schemaDir = join(root, 'packages/schema')

const sandbox = mkdtempSync(join(tmpdir(), 'cuestack-isolation-'))

try {
  // Pack the whole workspace dependency closure, not just core. @cuestack/core
  // depends on @cuestack/schema for types, and that package is not published —
  // so installing core alone would fail on resolution rather than on the thing
  // this check is about. Packing both keeps the guarantee meaningful.
  console.log('packing @cuestack/core and its workspace dependencies …')
  for (const dir of [schemaDir, coreDir]) {
    execFileSync('pnpm', ['pack', '--pack-destination', sandbox], { cwd: dir, stdio: 'pipe' })
  }

  const tarballs = readdirSync(sandbox).filter((f) => f.endsWith('.tgz'))
  if (tarballs.length < 2) throw new Error(`expected two tarballs, got ${tarballs.length}`)
  const tarball = tarballs.find((f) => f.includes('core'))
  if (!tarball) throw new Error('pnpm pack produced no core tarball')
  const schemaTarball = tarballs.find((f) => f.includes('schema'))

  // Both tarballs are installed as direct dependencies, which resolves the
  // workspace link without a registry and without an override npm would reject.
  writeFileSync(
    join(sandbox, 'package.json'),
    JSON.stringify(
      {
        name: 'isolation-probe',
        private: true,
        type: 'module',
      },
      null,
      2,
    ),
  )

  console.log('installing into a bare directory with no React …')
  execFileSync('npm', ['install', '--no-audit', '--no-fund', `./${schemaTarball}`, `./${tarball}`], {
    cwd: sandbox,
    stdio: 'pipe',
  })

  const installed = readdirSync(join(sandbox, 'node_modules'))
  const uiFrameworks = installed.filter((n) => ['react', 'react-dom', 'vue', 'svelte'].includes(n))
  if (uiFrameworks.length > 0) {
    console.error(`FAILED: installing @cuestack/core pulled in ${uiFrameworks.join(', ')}`)
    process.exit(1)
  }

  writeFileSync(
    join(sandbox, 'probe.mjs'),
    [
      "import * as core from '@cuestack/core'",
      "if (typeof core !== 'object') { console.error('core did not load'); process.exit(1) }",
      "console.log('imported @cuestack/core with no UI framework present')",
    ].join('\n'),
  )

  const output = execFileSync('node', ['probe.mjs'], {
    cwd: sandbox,
    stdio: 'pipe',
    encoding: 'utf8',
  })
  process.stdout.write(`  ${output.trim()}\n`)
  console.log(
    `check-core-isolation: ok — installed ${installed.length} package(s), none of them a UI framework`,
  )
} catch (error) {
  console.error('check-core-isolation: FAILED')
  console.error(`${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`)
  process.exit(1)
} finally {
  rmSync(sandbox, { recursive: true, force: true })
}
