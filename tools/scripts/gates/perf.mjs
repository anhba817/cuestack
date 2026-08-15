#!/usr/bin/env node
/**
 * Performance gate.
 *
 * Two halves, armed one wave apart. Wave 1 armed **resolution**: a 300-element slide must
 * resolve inside 10ms, which is the kernel's share of NFR-PERF-003's 100ms seek budget.
 * Wave 3 arms **playback**, which Wave 2 deferred with a stated reason — there were no
 * frames to drop. There are now.
 *
 * Runs the perf suites rather than reimplementing the measurement: one definition of each
 * budget, in the tests, where it can be read alongside what it protects.
 *
 * **What a pass here does and does not mean.** happy-dom has no compositor. Nothing in this
 * gate measures paint, and nothing in it can. The playback half measures the work the player
 * itself does — resolve, compose, the frame writer's property writes, and React's commit —
 * against a 16.7ms frame and a 100ms seek. That is a proxy, and it is the honest one: it
 * covers everything the framework controls and nothing it does not. A browser-based check is
 * what would close the gap, and this wave does not add one. Said out loud in the output
 * below, because a green gate is exactly the thing that gets read as a full answer.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { heavyLessonShape } from '../fixtures/heavy-lesson.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

function run(project, filter) {
  execFileSync('pnpm', ['exec', 'vitest', 'run', '--project', project, filter], {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
  })
}

try {
  run('@cuestack/core', 'perf')
} catch (error) {
  console.error('gate:perf — FAILED. Resolution exceeded its budget or stopped scaling linearly.')
  console.error(`${error.stdout ?? ''}${error.stderr ?? ''}`)
  process.exit(1)
}

try {
  run('@cuestack/react', 'test/perf')
} catch (error) {
  console.error('gate:perf — FAILED. Playback exceeded its frame or seek budget.')
  console.error(`${error.stdout ?? ''}${error.stderr ?? ''}`)
  process.exit(1)
}

const shape = heavyLessonShape()

console.log('gate:perf — resolution budget met (300 elements < 10ms, growth linear).')
console.log(
  `gate:perf — playback budgets met on the ${shape.slides}-slide/${shape.elements}-element ` +
    `fixture (${shape.media} media, ${shape.questions} required questions):`,
)
console.log('  per-frame player work < 16.7ms (60fps target), seek-to-rendered-state < 100ms,')
console.log('  each held to a further 10% margin so a regression fails while there is still room.')
console.log(
  '  This measures the player’s own work — resolve, compose, frame writes, React commit —',
)
console.log(
  '  and NOT paint. happy-dom has no compositor, so a browser-based check is still required',
)
console.log('  before claiming a frame rate. A pass here is not that claim.')
