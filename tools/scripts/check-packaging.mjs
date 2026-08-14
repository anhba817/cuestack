#!/usr/bin/env node
/**
 * Verifies every published package is actually consumable.
 *
 * The most consequential thing this wave ships is the `exports` map with its
 * `react-server` condition. It is also the thing most likely to be silently
 * wrong: a malformed condition order does not throw, it just resolves the client
 * bundle into a server context, and the symptom surfaces two waves later as a
 * hydration bug nobody can trace.
 *
 * publint catches malformed maps; attw catches type resolution that works for
 * the author's moduleResolution and breaks for a consumer's.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const packagesDir = join(root, 'packages')

const packages = readdirSync(packagesDir).filter((name) =>
  existsSync(join(packagesDir, name, 'package.json')),
)

let failed = false

function run(label, command, args, cwd) {
  process.stdout.write(`  ${label} … `)
  try {
    execFileSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' })
    console.log('ok')
    return true
  } catch (error) {
    console.log('FAILED')
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim()
    console.error(output.split('\n').map((l) => `      ${l}`).join('\n'))
    failed = true
    return false
  }
}

for (const name of packages) {
  const dir = join(packagesDir, name)
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  console.log(`\n${manifest.name}`)

  if (!existsSync(join(dir, 'dist'))) {
    console.error(`  not built — run \`pnpm build\` first`)
    failed = true
    continue
  }

  // T042: exports map well-formedness.
  run('publint', 'pnpm', ['exec', 'publint', '--strict'], dir)

  // T043: type resolution as a consumer sees it, not as the author does.
  //
  // The `esm-only` profile is the right one: these packages ship no CommonJS
  // entry on purpose (research.md, plan.md Constraints). Under the default
  // profile attw correctly reports "a require call resolved to an ESM file" for
  // every package — a true statement about a choice already made, so treating it
  // as a failure would train everyone to ignore this gate.
  run('attw', 'pnpm', ['exec', 'attw', '--pack', '.', '--profile', 'esm-only'], dir)
}

if (failed) {
  console.error('\ncheck-packaging: at least one package is not consumable as published.')
  process.exit(1)
}

console.log(`\ncheck-packaging: ok — ${packages.length} packages verified`)
