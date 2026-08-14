import { describe, expect, it } from 'vitest'
import { createAdvanceHarness } from '../harness/advance.js'
import { slide, textElement } from '../harness/corpus.js'

/** BR-007 — advancement fires at most once per slide instance. */
describe('BR-007', () => {
  const s = slide([textElement({ effects: [] })], { durationMs: 1000, advance: { mode: 'after_duration' } })

  it('decides once even when evaluated repeatedly', () => {
    const h = createAdvanceHarness()
    const decisions = Array.from({ length: 25 }, () => h.evaluate(s, { slideTimeMs: 2000 }))
    expect(decisions.filter((d) => d !== null)).toHaveLength(1)
  })

  it('the surviving decision is the first one', () => {
    const h = createAdvanceHarness()
    const first = h.evaluate(s, { slideTimeMs: 2000 })
    expect(first).not.toBeNull()
    expect(h.evaluate(s, { slideTimeMs: 3000 })).toBeNull()
  })
})
