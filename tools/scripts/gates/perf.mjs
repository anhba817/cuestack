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
 * **Reads `vitest.perf.config.ts`, and that is load-bearing.** These files used to be measured
 * twice — once here alone, once inside `pnpm test` against a dozen competing suites — and the two
 * runs disagreed. Excluding them from the workspace projects would have taken them from this gate
 * too, because `--project` selects a project whose own include/exclude decides its file set. So the
 * performance files live in their own config, and this is the only thing that reads it.
 *
 * **`@cuestack/schema` is here now.** It was not, and its validation scaling check was one of the
 * two tests that had been failing — so a relocation that did not add it would have deleted a budget
 * while leaving every board green.
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

const CONFIG = 'vitest.perf.config.ts'

/**
 * What each suite measured, against what it was allowed.
 *
 * **These numbers existed at every run and were discarded at every run.** The gate printed
 * "playback budgets met" and "per-frame player work < 16.7ms" — the limit and the verdict, never
 * the measurement — so a pass at 89ms against 90 and a pass at 12ms against 90 were the same line
 * of output. Nobody knew three budgets were passing within 3% of their thresholds until they
 * started failing.
 */
const measured = []

function run(project) {
  // `--disableConsoleIntercept` because the default reporter buffers console output from passing
  // tests and never prints it — which is how these measurements stayed invisible in the first place.
  const args = ['exec', 'vitest', 'run', '-c', CONFIG, '--project', project, '--disableConsoleIntercept']
  const out = execFileSync('pnpm', args, { cwd: root, stdio: 'pipe', encoding: 'utf8' })
  for (const line of out.split('\n')) {
    const found = /^perf: (.+?) \| ([0-9.]+) \| ([0-9.]+)$/.exec(line.trim())
    if (found) {
      measured.push({ label: found[1], value: Number(found[2]), limit: Number(found[3]) })
    }
  }
  return out
}

/** Tightest first: the budget about to become a flake is the one worth seeing at the top. */
function reportMeasurements() {
  if (measured.length === 0) {
    console.error('gate:perf — FAILED. The suites reported no measurements, so this gate printed')
    console.error('  verdicts it did not verify. Every perf suite emits `perf: label | value |')
    console.error('  limit` lines; something stopped emitting them or stopped being collected.')
    process.exit(1)
  }
  const used = (m) => m.value / m.limit
  const rows = [...measured].sort((a, b) => used(b) - used(a))
  const width = Math.max(...rows.map((m) => m.label.length))
  // Sub-millisecond budgets are real here — resolution is measured in tens of microseconds — so a
  // fixed two decimal places would print several of these as "0.00 / 0.00".
  const fmt = (n) => (n === 0 ? '0' : Math.abs(n) >= 1 ? n.toFixed(2) : n.toPrecision(3))
  console.log(`gate:perf — ${rows.length} measurements, closest to its limit first:`)
  for (const m of rows) {
    const pct = `${Math.round(used(m) * 100)}%`.padStart(4)
    console.log(`  ${pct} of budget  ${m.label.padEnd(width)}  ${fmt(m.value)} / ${fmt(m.limit)}`)
  }
}

/**
 * Report what actually failed.
 *
 * Every non-zero exit used to print the budget message, so a suite that could not be collected read
 * as a budget that had been exceeded — a failure naming the wrong cause, which costs the reader the
 * same hour the flake costs. Vitest exits 1 on *No test files found*, and this gate passes no
 * `--passWithNoTests`, so that case is loud; it just was not honest.
 */
function fail(project, budget, error) {
  const output = `${error.stdout ?? ''}${error.stderr ?? ''}`
  if (/No test files found/.test(output)) {
    console.error(
      `gate:perf — FAILED to collect ${project}. Its entry in ${CONFIG} matched no files, so ` +
        'nothing was measured. **This is not a budget failure.** A performance file was most ' +
        'likely renamed or moved without its include pattern following it.',
    )
  } else {
    console.error(budget)
  }
  console.error(output)
  process.exit(1)
}

try {
  run('@cuestack/core')
} catch (error) {
  fail(
    '@cuestack/core',
    'gate:perf — FAILED. Resolution exceeded its budget or stopped scaling linearly.',
    error,
  )
}

try {
  run('@cuestack/schema')
} catch (error) {
  fail(
    '@cuestack/schema',
    'gate:perf — FAILED. Validation exceeded its budget, or stopped scaling linearly between ' +
      '300 and 600 elements.',
    error,
  )
}

try {
  run('@cuestack/react')
} catch (error) {
  fail('@cuestack/react', 'gate:perf — FAILED. Playback exceeded its frame or seek budget.', error)
}

try {
  run('@cuestack/element')
} catch (error) {
  fail(
    '@cuestack/element',
    'gate:perf — FAILED. The web-component adapter exceeded its frame budget, or stopped ' +
      'building element structure once per element.',
    error,
  )
}

try {
  run('@cuestack/studio')
} catch (error) {
  fail(
    '@cuestack/studio',
    'gate:perf — FAILED. The editor exceeded an interaction, seek, or startup budget.',
    error,
  )
}

reportMeasurements()

const shape = heavyLessonShape()

console.log('gate:perf — resolution budget met (300 elements < 10ms, growth linear).')
console.log(
  'gate:perf — validation budget met (50 slides/300 elements < 500ms) and scaling stayed linear\n' +
    '  between 300 and 600 elements. This package joined the gate in feature 013; before that its\n' +
    '  only enforcer was the ordinary suite, where the measurement was taken against a dozen\n' +
    '  competing suites and failed at a ratio of 7.93 against a limit of 6.',
)
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
