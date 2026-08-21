#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

/**
 * FR-011 — play one lesson through both adapters and print what differs.
 *
 * **Deliberately not in `tools/scripts/gates/`.** `run-all.mjs` runs everything in that directory
 * and fails the build on a non-zero exit, so a reporter placed there works today and is a category
 * error: the next reader makes it fail on a difference, and FR-011's decision is reversed by a
 * one-line change nobody reviews as a decision.
 *
 * **It exits zero whatever it found.** Preview-versus-playback is one renderer compared against
 * itself, so a difference there is a bug and gates. This is two renderers by design over one kernel
 * — one draws a notice where the other draws a video — and encoding which differences are permitted
 * is exactly the list that goes stale. The suite it spawns still fails on its own narrow assertion:
 * a *shared kernel property* arriving differently in the two adapters is a bug, and that one does
 * gate, inside `pnpm test`.
 *
 * It spawns vitest rather than computing anything, because a plain node process has neither React
 * nor a DOM and can drive neither adapter. The parity gate solves the same problem the same way.
 */

const run = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', '--project', '@cuestack/element', 'agreement', '--reporter=verbose'],
  { encoding: 'utf8', cwd: new URL('../..', import.meta.url).pathname },
)

const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
const report = output.slice(
  output.indexOf('--- adapter agreement ---'),
  output.indexOf('--- end ---') + '--- end ---'.length,
)

console.log(report || output)

if (run.status !== 0) {
  console.log(
    '\nThe suite itself failed. That is not a reported difference — it means either a shared\n' +
      'kernel property disagreed between the adapters, or the comparison never ran. Both are\n' +
      'caught by `pnpm test`; this script does not gate on them.',
  )
}

// Zero, always. See the header.
process.exit(0)
