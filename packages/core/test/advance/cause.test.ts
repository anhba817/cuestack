import { describe, expect, it } from 'vitest'
import { createAdvanceHarness } from '../harness/advance.js'
import { slide, textElement } from '../harness/corpus.js'

/** "Why did this advance early" is otherwise unanswerable from a bug report. */
describe('decision cause', () => {
  it('names duration', () => {
    const s = slide([textElement({ effects: [] })], { durationMs: 1000, advance: { mode: 'after_duration' } })
    const d = createAdvanceHarness().evaluate(s, { slideTimeMs: 1500 })
    expect(d?.cause).toBe('duration')
    expect(d?.atSlideTimeMs).toBe(1500)
  })

  it('names learner action', () => {
    const s = slide([textElement({ effects: [] })], { durationMs: 1000, advance: { mode: 'on_click' } })
    expect(createAdvanceHarness().evaluate(s, {}, { learnerAdvanced: true })?.cause).toBe('learner_action')
  })

  it('names media', () => {
    const s = slide(
      [textElement({ id: 'v', type: 'video', startMs: 0, endMs: 5000, effects: [], payload: { asset: { assetId: 'a', mimeType: 'video/mp4', durationMs: 5000 } } })],
      { durationMs: 5000, advance: { mode: 'after_media_ends', mediaElementId: 'v' } },
    )
    const h = createAdvanceHarness()
    h.ports.setMedia('v', { ended: true })
    expect(h.evaluate(s)?.cause).toBe('media_ended')
  })

  it('names interaction completion', () => {
    const s = slide(
      [textElement({ id: 'q', type: 'question', startMs: 0, endMs: 5000, effects: [], payload: { interactionType: 'true_false', prompt: 'p', options: [{ id: 'y', label: 'Y' }, { id: 'n', label: 'N' }], correctResponse: 'y', required: true } })],
      { durationMs: 5000, advance: { mode: 'after_interaction', interactionElementId: 'q' } },
    )
    const d = createAdvanceHarness().evaluate(s, {}, { completedInteractions: new Set(['q']) })
    expect(d?.cause).toBe('interaction_completed')
  })
})
