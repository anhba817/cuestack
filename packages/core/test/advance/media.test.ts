import { describe, expect, it } from 'vitest'
import { createAdvanceHarness } from '../harness/advance.js'
import { slide, textElement } from '../harness/corpus.js'

const s = slide(
  [textElement({ id: 'video', type: 'video', startMs: 0, endMs: 30000, effects: [], payload: { asset: { assetId: 'a', mimeType: 'video/mp4', durationMs: 28000 } } })],
  { durationMs: 30000, advance: { mode: 'after_media_ends', mediaElementId: 'video' } },
)

describe('media-gated advancement', () => {
  it('postpones rather than cancels when the media is paused', () => {
    const h = createAdvanceHarness()
    h.ports.setMedia('video', { paused: true, ended: false, positionMs: 12000 })
    expect(h.evaluate(s)).toBeNull()

    // Resuming and finishing must still advance — no cancellation state exists.
    h.ports.setMedia('video', { paused: false, ended: true })
    expect(h.evaluate(s)?.cause).toBe('media_ended')
  })

  it('does not advance while media has not been attached yet', () => {
    const h = createAdvanceHarness()
    expect(h.evaluate(s)).toBeNull()
  })

  it('reports blocked when the media has failed, rather than waiting forever', () => {
    const h = createAdvanceHarness()
    h.ports.setMedia('video', { failed: true })
    const blocked = h.controller.reachability(s, h.ports.media)
    expect(blocked?.code).toBe('ADVANCE_MEDIA_FAILED')
    expect(blocked?.elementId).toBe('video')
  })

  it('a learner staring at a stalled slide is distinguishable from a manual slide', () => {
    const manual = slide([textElement({ effects: [] })], { durationMs: 1000, advance: { mode: 'on_click' } })
    const h = createAdvanceHarness()
    expect(h.controller.reachability(manual)).toBeNull()
    h.ports.setMedia('video', { failed: true })
    expect(h.controller.reachability(s, h.ports.media)).not.toBeNull()
  })
})
