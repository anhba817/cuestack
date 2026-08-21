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
    /**
     * **The manual slide now carries a Continue button, and that is the point of the change.**
     *
     * This test read `advance: { mode: 'on_click' }` with no control on the slide and expected
     * nothing reported — under the old premise that a learner can always click. Nothing raised the
     * signal and the player offered no next control, so such a slide stranded every learner while
     * this check called it fine. A manual slide is now one a learner can actually leave.
     *
     * What the test is *for* is unchanged: a stalled slide and a deliberately-manual one must not
     * look alike.
     */
    const manual = slide(
      [
        textElement({ effects: [] }),
        textElement({
          id: 'go',
          type: 'button',
          effects: [],
          payload: { label: 'Continue', action: 'next_slide' },
        }),
      ],
      { durationMs: 1000, advance: { mode: 'on_click' } },
    )
    const h = createAdvanceHarness()
    expect(h.controller.reachability(manual)).toBeNull()
    h.ports.setMedia('video', { failed: true })
    expect(h.controller.reachability(s, h.ports.media)).not.toBeNull()
  })
})
