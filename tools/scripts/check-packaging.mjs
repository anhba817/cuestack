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

/**
 * Extensions that carry no type information by nature. An allow-list, not a deny-list:
 * the first attempt excluded anything that did not *end* in `.js`/`.json`, which quietly
 * dropped `@cuestack/schema`'s `./fixtures/*` — a wildcard that was resolving and passing.
 * Losing a check while fixing an unrelated one is exactly what this shape prevents.
 */
const ASSET_EXTENSION = /\.(?:css|s[ac]ss|svg|png|jpe?g|gif|webp|avif|woff2?|ttf|eot|txt|md)$/

/**
 * Export subpaths that resolve to a non-code asset, without their leading `./`.
 *
 * Only string targets count. A conditional object could hide a JavaScript target behind a
 * condition, and excluding one of those from the types checker would be a real loss of
 * coverage rather than a correct exemption.
 */
function assetSubpaths(manifest) {
  const exports = manifest.exports ?? {}
  return Object.entries(exports)
    .filter(([sub, target]) => sub !== '.' && typeof target === 'string' && ASSET_EXTENSION.test(target))
    .map(([sub]) => sub.replace(/^\.\//, ''))
}

/** Frameworks a host owns exactly one copy of. */
const HOST_OWNED = ['react', 'react-dom', 'vue', 'svelte', '@angular/core']

/**
 * A UI framework must appear as a peer dependency and nowhere else.
 *
 * A devDependency is fine and necessary — the adapter has to build and test against a real
 * React. What must not happen is a runtime `dependencies` entry, which installs a second
 * copy beside the host's.
 */
function checkPeers(manifest) {
  process.stdout.write('  peers … ')
  const problems = []
  const deps = manifest.dependencies ?? {}
  const peers = manifest.peerDependencies ?? {}

  for (const framework of HOST_OWNED) {
    if (deps[framework] !== undefined) {
      problems.push(
        `${framework} is a runtime dependency; it must be a peer so the host's copy is the only copy`,
      )
    }
  }

  // The converse: a package that *imports* a framework must declare it, or a consumer
  // installs the package and gets an unresolvable import at runtime.
  const importsReact = existsSync(join(packagesDir, manifest.name.replace('@cuestack/', ''), 'src'))
    ? readdirSync(join(packagesDir, manifest.name.replace('@cuestack/', ''), 'src'), { recursive: true })
        .filter((f) => /\.tsx?$/.test(String(f)))
        .some((f) =>
          /from 'react(?:-dom)?(?:\/[\w./-]+)?'/.test(
            readFileSync(join(packagesDir, manifest.name.replace('@cuestack/', ''), 'src', String(f)), 'utf8'),
          ),
        )
    : false

  if (importsReact && peers['react'] === undefined) {
    problems.push('imports react but does not declare it as a peer dependency')
  }

  if (problems.length > 0) {
    console.log('FAILED')
    for (const p of problems) console.error(`      ${p}`)
    failed = true
    return
  }
  console.log(peers['react'] === undefined ? 'ok (no framework)' : `ok (react ${peers['react']} as peer)`)
}

/**
 * Conditional exports resolve in declaration order, which makes their order load-bearing
 * and invisible.
 *
 * `react-server` must come before `default`, or every consumer gets the server build —
 * including browsers, where a player that never starts a clock simply never plays. And
 * `default` must exist, or a host that applies no conditions at all (a bundler, a plain
 * Node import) resolves nothing.
 *
 * Neither mistake throws. The first symptom is a player that renders and does not move.
 */
function checkConditionOrder(manifest, dir) {
  const root = manifest.exports?.['.']
  if (root === undefined || typeof root === 'string') return

  process.stdout.write('  conditions … ')
  const problems = []
  const keys = Object.keys(root)

  if (!keys.includes('default')) {
    problems.push('the "." export declares no `default` condition, so an unconditioned import resolves nothing')
  }

  const server = keys.indexOf('react-server')
  const fallback = keys.indexOf('default')
  if (server > -1 && fallback > -1 && server > fallback) {
    problems.push('`react-server` is declared after `default`, so it can never be selected')
  }

  // The two must be different files. A single entry behind both conditions means one of
  // them is a lie, and the RSC boundary is where that surfaces — as a hook in a server
  // component, two waves later.
  const serverTarget = server > -1 ? targetOf(root['react-server']) : undefined
  const clientTarget = fallback > -1 ? targetOf(root['default']) : undefined
  if (serverTarget !== undefined && serverTarget === clientTarget) {
    problems.push(`\`react-server\` and \`default\` both resolve to ${serverTarget}`)
  }

  for (const target of [serverTarget, clientTarget]) {
    if (target !== undefined && !existsSync(join(dir, target))) {
      problems.push(`${target} is declared but not built`)
    }
  }

  if (problems.length > 0) {
    console.log('FAILED')
    for (const p of problems) console.error(`      ${p}`)
    failed = true
    return
  }
  console.log(serverTarget === undefined ? 'ok (no server condition)' : `ok (${serverTarget} / ${clientTarget})`)
}

function targetOf(entry) {
  if (typeof entry === 'string') return entry
  if (entry !== null && typeof entry === 'object') return entry.default ?? entry.import
  return undefined
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

  // T070 (feature 003): a UI framework must be a peer, never a dependency.
  //
  // FR-026. Two copies of React in one page is not a slow page, it is a broken one —
  // hooks throw, context does not match, and the error names neither cause. publint does
  // not check this, because bundling a framework is legal and merely wrong.
  checkPeers(manifest)

  // T072 (feature 003): the client path must not depend on the server condition.
  checkConditionOrder(manifest, dir)

  // T043: type resolution as a consumer sees it, not as the author does.
  //
  // The `esm-only` profile is the right one: these packages ship no CommonJS
  // entry on purpose (research.md, plan.md Constraints). Under the default
  // profile attw correctly reports "a require call resolved to an ESM file" for
  // every package — a true statement about a choice already made, so treating it
  // as a failure would train everyone to ignore this gate.
  //
  // Asset entrypoints are excluded, because attw checks *types* and a stylesheet has
  // none. `@cuestack/react/styles.css` reported "Resolution failed" for exactly that
  // reason, and it was mistaken for a broken export map for most of a wave. Derived from
  // the manifest rather than listed by hand: a second asset export is then excluded
  // automatically, and a *JavaScript* export can never be excluded by accident.
  const assetEntrypoints = assetSubpaths(manifest)
  if (assetEntrypoints.length > 0) {
    console.log(`  attw excluding ${assetEntrypoints.join(', ')} — assets carry no types`)
  }
  run(
    'attw',
    'pnpm',
    [
      'exec',
      'attw',
      '--pack',
      '.',
      '--profile',
      'esm-only',
      ...assetEntrypoints.flatMap((sub) => ['--exclude-entrypoints', sub]),
    ],
    dir,
  )
}

if (failed) {
  console.error('\ncheck-packaging: at least one package is not consumable as published.')
  process.exit(1)
}

console.log(`\ncheck-packaging: ok — ${packages.length} packages verified`)
