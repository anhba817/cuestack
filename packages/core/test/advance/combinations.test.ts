import { describe, expect, it } from 'vitest'
import { createAdvanceHarness } from '../harness/advance.js'
import { slide, textElement } from '../harness/corpus.js'

/**
 * SC-005: exactly one decision under every combination of simultaneously
 * satisfied conditions.
 *
 * Swept rather than sampled because three conditions firing in the same tick is
 * not a case anyone writes by hand, and it is precisely where a guard keyed on
 * the wrong thing shows up.
 */
const MODES = ['after_duration', 'on_click', 'after_media_ends', 'after_interaction'] as const

function build(mode: (typeof MODES)[number]) {
  const advance =
    mode === 'after_media_ends'
      ? { mode, mediaElementId: 'video' }
      : mode === 'after_interaction'
        ? { mode, interactionElementId: 'q' }
        : { mode }
  return slide(
    [
      textElement({ id: 'video', type: 'video', startMs: 0, endMs: 5000, effects: [], payload: { asset: { assetId: 'a', mimeType: 'video/mp4', durationMs: 5000 } } }),
      textElement({
        id: 'q',
        type: 'question',
        startMs: 0,
        endMs: 5000,
        effects: [],
        payload: {
          interactionType: 'true_false',
          prompt: 'p',
          options: [{ id: 'y', label: 'Y' }, { id: 'n', label: 'N' }],
          correctResponse: 'y',
          required: true,
        },
      }),
    ],
    { durationMs: 5000, advance },
  )
}

describe('simultaneous advance conditions', () => {
  // Every combination of the three externally-supplied signals, against every mode.
  const signalSets = [false, true].flatMap((durationPassed) =>
    [false, true].flatMap((mediaEnded) =>
      [false, true].flatMap((learnerAdvanced) =>
        [false, true].map((interactionDone) => ({
          durationPassed,
          mediaEnded,
          learnerAdvanced,
          interactionDone,
        })),
      ),
    ),
  )

  it.each(MODES)('mode %s decides at most once across all 16 signal combinations', (mode) => {
    for (const set of signalSets) {
      const h = createAdvanceHarness()
      const s = build(mode)
      h.ports.setMedia('video', { ended: set.mediaEnded })
      const decisions: unknown[] = []
      // Evaluate several times with the same conditions: repeated ticks must not
      // produce repeated decisions.
      for (let i = 0; i < 4; i++) {
        const d = h.evaluate(
          s,
          { slideTimeMs: set.durationPassed ? 6000 : 100 },
          {
            learnerAdvanced: set.learnerAdvanced,
            completedInteractions: set.interactionDone ? new Set(['q']) : new Set(),
          },
        )
        if (d) decisions.push(d)
      }
      expect(decisions.length).toBeLessThanOrEqual(1)
    }
  })

  it('advances exactly once when duration, media, and interaction all fire together', () => {
    const h = createAdvanceHarness()
    const s = build('after_duration')
    h.ports.setMedia('video', { ended: true })
    const decisions = [0, 1, 2].map(() =>
      h.evaluate(s, { slideTimeMs: 9999 }, { learnerAdvanced: true, completedInteractions: new Set(['q']) }),
    )
    expect(decisions.filter(Boolean)).toHaveLength(1)
  })
})
