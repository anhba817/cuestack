import { describe, expect, it } from 'vitest'
import {
  MEDIA_SYNC_TOLERANCE_MS,
  MEDIA_REPORT_INTERVAL_MS,
} from '../../src/media/reconcile.js'
import { CLAMP_CEILING_MS } from '../../src/time/clock.js'

/**
 * The tolerance is derived, and its derivation is checked where checking is meaningful.
 *
 * Its **ceiling** is asserted in `@cuestack/react`, against the seek control's step — that
 * bound is real, because the step is owned by code that can change independently and Wave
 * 4's timeline will want finer scrubbing.
 *
 * Its **floor** is not asserted numerically here. `expect(500).toBeGreaterThan(250)` between
 * two literals in one file looks like a check and is a tautology: it can only fail if
 * someone edits both. The floor is pinned *behaviourally* in `reconcile.test.ts` — a report
 * one interval past the commanded position is still an echo — which is the property the
 * number exists to produce.
 *
 * What is worth asserting here is the provenance: the report interval is the same figure
 * Wave 1 chose for the clock clamp, for the same physical reason, and if one moves the other
 * should be reconsidered rather than silently diverging.
 */
describe('the media synchronisation tolerance', () => {
  it('assumes the same report cadence Wave 1 assumed for the clock clamp', () => {
    // Not a coincidence to preserve blindly: both are "how often can a browser be relied on
    // to tick". If a future wave measures something better, both should change together.
    expect(MEDIA_REPORT_INTERVAL_MS).toBe(CLAMP_CEILING_MS)
  })

  it('is a whole number of milliseconds, like every other timing value (BR-001)', () => {
    expect(Number.isInteger(MEDIA_SYNC_TOLERANCE_MS)).toBe(true)
    expect(Number.isInteger(MEDIA_REPORT_INTERVAL_MS)).toBe(true)
  })

  it('leaves room above the report interval for a playing element to have moved on', () => {
    // Stated as a relationship rather than as two literals: what matters is that a report
    // arriving one interval late is still inside the tolerance, with margin.
    expect(MEDIA_SYNC_TOLERANCE_MS).toBeGreaterThan(MEDIA_REPORT_INTERVAL_MS)
  })
})
