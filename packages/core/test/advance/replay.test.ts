import { describe, expect, it } from 'vitest'
import { createAdvanceHarness } from '../harness/advance.js'
import { slide, textElement } from '../harness/corpus.js'

/**
 * Research R-05: the guard keys on slide *instance*, not slide id.
 *
 * Keying on the id alone would break a learner navigating backward and replaying
 * a slide, which must be able to advance again.
 */
describe('replayed slides', () => {
  const s = slide([textElement({ effects: [] })], { durationMs: 1000, advance: { mode: 'after_duration' } })

  it('a second visit can advance again', () => {
    const h = createAdvanceHarness()
    expect(h.evaluate(s, { instanceId: 'slide_a#1', slideTimeMs: 2000 })).not.toBeNull()
    expect(h.evaluate(s, { instanceId: 'slide_a#1', slideTimeMs: 2000 })).toBeNull()
    // Same slide, new visit.
    expect(h.evaluate(s, { instanceId: 'slide_a#2', slideTimeMs: 2000 })).not.toBeNull()
  })

  it('distinguishes "already advanced" from "visited afresh" without tracking history', () => {
    const h = createAdvanceHarness()
    for (const visit of [1, 2, 3, 4]) {
      const id = `slide_a#${visit}`
      expect(h.evaluate(s, { instanceId: id, slideTimeMs: 2000 })).not.toBeNull()
      expect(h.evaluate(s, { instanceId: id, slideTimeMs: 2000 })).toBeNull()
    }
  })

  it('names the instance that advanced', () => {
    const h = createAdvanceHarness()
    const d = h.evaluate(s, { instanceId: 'slide_z#7', slideTimeMs: 2000 })
    expect(d?.instanceId).toBe('slide_z#7')
  })
})
