import { describe, expect, it } from 'vitest'
import { createAdvanceHarness } from '../harness/advance.js'
import { slide, textElement } from '../harness/corpus.js'

describe('late signals', () => {
  const s = slide([textElement({ effects: [] })], { durationMs: 1000, advance: { mode: 'on_click' } })

  it('ignores a completion arriving after the instance advanced', () => {
    const h = createAdvanceHarness()
    expect(h.evaluate(s, {}, { learnerAdvanced: true })).not.toBeNull()
    expect(h.evaluate(s, {}, { learnerAdvanced: true })).toBeNull()
  })

  it('a reset restores the ability to decide — used when a slide is revisited', () => {
    const h = createAdvanceHarness()
    expect(h.evaluate(s, {}, { learnerAdvanced: true })).not.toBeNull()
    h.controller.reset('slide_a#1')
    expect(h.evaluate(s, {}, { learnerAdvanced: true })).not.toBeNull()
  })
})
