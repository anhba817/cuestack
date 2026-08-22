/**
 * One result shape, and the sentences each reference may not say.
 *
 * **A figure without its conditions is not a weaker result — it is a false one**, because a reader
 * supplies the missing context from whatever they assumed. So every measurement travels with its
 * reference, engine, subject, throttling, both statistics, the sample count, and the claims it does
 * not support.
 */

export const REFERENCES = {
  ci: {
    label: 'CI reference',
    throttle: 1,
    subject: 'heavy fixture (50 slides / 300 elements)',
    standsFor: 'the project CI runner, unthrottled',
    mayNotSay: 'anything about a learner’s device — this is a datacentre VM with no GPU',
  },
  baseline: {
    label: 'Baseline reference',
    throttle: 4,
    subject: 'the tour lesson',
    standsFor: 'a several-year-old school laptop or mid-range Chromebook (~4x CPU)',
    mayNotSay:
      'anything measured on real hardware — a throttled desktop keeps the desktop’s memory ' +
      'bandwidth, GPU and display pipeline, so this estimates that class of machine rather than ' +
      'measuring one',
  },
}

const pct = (n) => `${Math.round(n * 100)}%`

export function formatMeasurement(key, engine, stats) {
  const ref = REFERENCES[key]
  const lines = [
    `${ref.label}  ${engine}  ${ref.subject}  ${ref.throttle > 1 ? `${ref.throttle}x CPU` : 'unthrottled'}`,
    `  stands for       ${ref.standsFor}`,
    `  median frame     ${stats.medianMs.toFixed(2)} ms / ${stats.targetMs.toFixed(2)} ms target  (${pct(stats.medianMs / stats.targetMs)} of budget)`,
    `  frames > floor   ${stats.overFloor} of ${stats.frames}  (floor ${stats.floorMs.toFixed(2)} ms)`,
    `  may NOT be used to say  ${ref.mayNotSay}`,
  ]
  return lines.join('\n')
}

/**
 * What a green result still does not mean.
 *
 * The performance gate has printed its own version of this on every run since Wave 3, and it is the
 * only reason nobody has read the proxy as the thing. A number without that discipline attached
 * becomes the claim by default.
 */
export function limits() {
  return [
    'What this does NOT cover:',
    '  - real hardware. Both figures are taken on the CI runner; one of them is throttled to',
    '    approximate a school laptop, which is an estimate of that class and not a measurement.',
    '  - a cross-engine frame claim. Timing is single-engine by design, because three frame',
    '    numbers would be three unrelated numbers. Engine breadth belongs to the behaviour suite.',
    '  - frames the compositor never scheduled, and work on other threads.',
    '  - the devices teachers actually own.',
  ].join('\n')
}

export function formatVariance(key, runs) {
  const medians = runs.map((r) => r.medianMs)
  const over = runs.map((r) => r.overFloor)
  const spread = (xs) => `${Math.min(...xs).toFixed(2)}–${Math.max(...xs).toFixed(2)}`
  return [
    `${REFERENCES[key].label}  ${runs.length} runs`,
    `  median frame     ${spread(medians)} ms`,
    `  frames > floor   ${Math.min(...over)}–${Math.max(...over)}`,
    '  No threshold may be written down until this spread is known (FR-007). A bound of zero is',
    '  one garbage collection from permanently red; a bound invented to avoid that is not a',
    '  measurement.',
  ].join('\n')
}
