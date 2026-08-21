#!/usr/bin/env node
/**
 * SC-007, the consumer-facing half: `@cuestack/element` installs and imports with **no UI framework
 * anywhere in the tree**.
 *
 * The dependency-cruiser rule proves `packages/element/src` does not import `@cuestack/react`. This
 * proves the stronger claim a host actually cares about: pack the tarball, install it alone, and
 * import it. A transitive dependency dragging React in would pass the lint rule and fail here — and
 * for this package that is the whole point, because "plays a lesson with no framework present" is
 * the claim DX-2 exists to make and a lint rule does not make it.
 *
 * Deliberately a sibling of `check-core-isolation.mjs` rather than a parameterisation of it. The two
 * differ in what counts as the dependency closure and in what the probe does once loaded, and a
 * shared runner would have to be told both — at which point it is two scripts wearing one name.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sandbox = mkdtempSync(join(tmpdir(), 'cuestack-element-isolation-'))

try {
  // schema and core are workspace dependencies and are not published, so installing the element
  // alone would fail on resolution rather than on the thing this checks.
  console.log('packing @cuestack/element and its workspace dependencies …')
  for (const name of ['schema', 'core', 'element']) {
    execFileSync('pnpm', ['pack', '--pack-destination', sandbox], {
      cwd: join(root, 'packages', name),
      stdio: 'pipe',
    })
  }

  const tarballs = readdirSync(sandbox).filter((f) => f.endsWith('.tgz'))
  const find = (part) => {
    const hit = tarballs.find((f) => f.includes(part))
    if (!hit) throw new Error(`pnpm pack produced no ${part} tarball`)
    return `./${hit}`
  }

  writeFileSync(
    join(sandbox, 'package.json'),
    JSON.stringify({ name: 'element-isolation-probe', private: true, type: 'module' }, null, 2),
  )

  console.log('installing into a bare directory with no React …')
  execFileSync(
    'npm',
    ['install', '--no-audit', '--no-fund', find('schema'), find('core'), find('element')],
    { cwd: sandbox, stdio: 'pipe' },
  )

  const installed = readdirSync(join(sandbox, 'node_modules'))
  const frameworks = installed.filter((n) =>
    ['react', 'react-dom', 'vue', 'svelte', 'preact', '@angular'].includes(n),
  )
  if (frameworks.length > 0) {
    console.error(`FAILED: installing @cuestack/element pulled in ${frameworks.join(', ')}`)
    process.exit(1)
  }

  /**
   * The probe imports rather than renders. `customElements` does not exist in node, and the module's
   * registration side effect is guarded on exactly that — so this also checks the guard: an
   * unguarded `customElements.define` would throw on import here, which is what a host doing SSR
   * would hit before ever reaching a browser.
   */
  writeFileSync(
    join(sandbox, 'probe.mjs'),
    [
      "import * as element from '@cuestack/element'",
      "if (typeof element.LessonElement !== 'function') {",
      "  console.error('LessonElement did not load'); process.exit(1)",
      '}',
      // Four since feature 012: `button` joined, being the only declined type whose exclusion had
      // no reason of its own — it was out because navigation was unreachable in *both* adapters.
      'if (element.COVERED.length !== 4) {',
      "  console.error('unexpected covered set: ' + element.COVERED); process.exit(1)",
      '}',
      "console.log('imported @cuestack/element with no UI framework and no DOM present')",
    ].join('\n'),
  )

  const output = execFileSync('node', ['probe.mjs'], { cwd: sandbox, stdio: 'pipe', encoding: 'utf8' })
  process.stdout.write(`  ${output.trim()}\n`)
  console.log(
    `check-element-isolation: ok — installed ${installed.length} package(s), none of them a UI framework`,
  )
} catch (error) {
  console.error('check-element-isolation: FAILED')
  console.error(`${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`)
  process.exit(1)
} finally {
  rmSync(sandbox, { recursive: true, force: true })
}
