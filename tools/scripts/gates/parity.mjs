#!/usr/bin/env node
/**
 * Parity gate — armed in feature 007 (ED-6).
 *
 * A placeholder since Wave 1, with an honest reason each time: first there was no editor,
 * then no preview. Both halves now exist, so FR-FWK-013 — "registered elements render
 * consistently in editor preview and learner playback" — is finally a claim something can
 * check rather than a property everyone assumed.
 *
 * **What it runs, and why it is four suites rather than one.** Parity is not one comparison:
 *
 *   - `overlay.test.tsx`   the editor's render layer, overlay subtracted, byte-identical to
 *                          the player's — across all seven types, with a selection active,
 *                          with a ghost present. Written by feature 005.
 *   - `geometry.test.tsx`  geometry, rotation, and paint order agree.
 *   - `state.test.tsx`     the comparison changes with time, so the equalities are not vacuous.
 *   - `renderers.test.tsx` the two *renderer sets* say the same thing. `staticRenderers` and
 *                          `builtinRenderers` differ in exactly one member, and the editor
 *                          draws with one while a learner gets the other. Added by feature 007.
 *   - `composition.test.tsx` the preview mounts the player unmodified.
 *
 * Running only the new file would have armed a gate that no longer checked the three things
 * already written, which is the failure mode a gate is supposed to prevent.
 *
 * **What this does NOT prove.** Constitution V calls a parity divergence reaching production
 * a severity-2 defect, and an automated comparison of rendered markup is not the whole of it:
 * timing tolerance (FR-027) is argued structurally — there is one clock and one `resolve` —
 * rather than measured, and a divergence in *behaviour under interaction* is only as covered
 * as the suites above happen to be.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const dir = join(root, 'packages/studio/test/parity')
const hasWork = existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.test.tsx'))

if (!hasWork) {
  console.log('gate:parity — no editor-side parity suites yet; nothing to check.')
  process.exit(0)
}

try {
  execFileSync('pnpm', ['exec', 'vitest', 'run', '--project', '@cuestack/studio', 'parity'], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
  })
  const suites = readdirSync(dir).filter((f) => f.endsWith('.test.tsx')).sort()
  console.log(`gate:parity — ok, ${suites.length} suites agree: ${suites.join(', ')}.`)
  console.log('  Rendered output only. Timing tolerance is structural (one clock, one resolve),')
  console.log('  and behaviour under interaction is covered only as far as these suites reach.')
} catch (error) {
  console.error('gate:parity — FAILED. The editor and the player disagree about a lesson.')
  console.error(`${error.stdout ?? ''}${error.stderr ?? ''}`)
  process.exit(1)
}
