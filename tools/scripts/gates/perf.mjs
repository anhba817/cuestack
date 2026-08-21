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

try {
  run('@cuestack/element', 'test/perf')
} catch (error) {
  console.error(
    'gate:perf — FAILED. The web-component adapter exceeded its frame budget, or stopped ' +
      'building element structure once per element.',
  )
  console.error(`${error.stdout ?? ''}${error.stderr ?? ''}`)
  process.exit(1)
}

try {
  run('@cuestack/studio', 'test/perf')
} catch (error) {
  console.error('gate:perf — FAILED. The editor exceeded an interaction, seek, or startup budget.')
  console.error(`${error.stdout ?? ''}${error.stderr ?? ''}`)
  process.exit(1)
}

const shape = heavyLessonShape()

console.log('gate:perf — resolution budget met (300 elements < 10ms, growth linear).')
console.log(
  'gate:perf — the web-component adapter holds a frame on a 55-element slide, and a slide change\n' +
    '  including its stage clone inside two. **The measured margin is about ninefold**, so the\n' +
    '  wall-clock half of that catches only a gross regression; the invariant beside it — structure\n' +
    '  built once per element, never per frame — is what a rebuild trips, and a stopwatch in a DOM\n' +
    '  with no layout would not.',
)
console.log(
  `gate:perf — playback budgets met on the ${shape.slides}-slide/${shape.elements}-element ` +
    `fixture (${shape.media} media, ${shape.questions} required questions):`,
)
console.log('  per-frame player work < 16.7ms (60fps target), seek-to-rendered-state < 100ms,')
console.log('  each held to a further 10% margin so a regression fails while there is still room.')
console.log(
  `gate:perf — editor budgets met on the same fixture: selection and transform feedback ` +
    '< 100ms (NFR-PERF-002), authoring-time change < 100ms (NFR-PERF-003, it is a seek), and',
)
console.log('  interactive at 50 slides/300 elements < 3s (NFR-PERF-001), each with the same margin.')
console.log(
  `gate:perf — timeline budgets met on the densest slide (${shape.densestSlide} elements): ` +
    'playhead-to-rendered-state < 100ms (SC-003) and drag feedback < 100ms (SC-004).',
)
console.log(
  '  Measured against the *dense* slide deliberately. The timeline is per-slide, so an even',
)
console.log(
  '  six-per-slide spread would let SC-012 pass while measuring nothing (feature 006, R-09).',
)
console.log(
  '  This measures the player’s own work — resolve, compose, frame writes, React commit —',
)
console.log(
  '  and NOT paint. happy-dom has no compositor, so a browser-based check is still required',
)
console.log('  before claiming a frame rate. A pass here is not that claim.')
