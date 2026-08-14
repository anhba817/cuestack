import { describe, expect, it } from 'vitest'
import { createAdvanceHarness } from '../harness/advance.js'
import { slide, textElement } from '../harness/corpus.js'

/** BR-006 — media-end advancement references a playable media element on the slide. */
const mediaSlide = (mediaElementId: string) =>
  slide(
    [
      textElement({ id: 'video', type: 'video', startMs: 0, endMs: 30000, effects: [], payload: { asset: { assetId: 'a', mimeType: 'video/mp4', durationMs: 1000 } } }),
      textElement({ id: 'caption', startMs: 0, endMs: 30000, effects: [] }),
    ],
    { durationMs: 30000, advance: { mode: 'after_media_ends', mediaElementId } },
  )

describe('BR-006', () => {
  it('advances when the referenced media ends', () => {
    const h = createAdvanceHarness()
    h.ports.setMedia('video', { ended: true })
    expect(h.evaluate(mediaSlide('video'))?.cause).toBe('media_ended')
  })

  it('does not advance while the media is still playing', () => {
    const h = createAdvanceHarness()
    h.ports.setMedia('video', { ended: false, positionMs: 5000 })
    expect(h.evaluate(mediaSlide('video'))).toBeNull()
  })

  it('reports blocked when the reference names a non-media element', () => {
    const h = createAdvanceHarness()
    expect(h.controller.reachability(mediaSlide('caption'))?.code).toBe('ADVANCE_UNSATISFIABLE')
  })

  it('reports blocked when the reference names nothing on this slide', () => {
    const h = createAdvanceHarness()
    expect(h.controller.reachability(mediaSlide('absent'))?.code).toBe('ADVANCE_UNSATISFIABLE')
  })
})
