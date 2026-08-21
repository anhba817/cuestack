import { describe, expect, it } from 'vitest'
import { collectProblems } from '../../src/resolve/problems.js'
import { severityFor } from '../../src/validation/severity.js'
import { slide, textElement } from '../harness/corpus.js'

/**
 * FR-011b — an author is told when the control they placed can never be operated.
 *
 * This framework's own defect one level up. Feature 012 exists because a Continue button rendered
 * correctly and did nothing; after it, such a button on a *gated* slide is permanently disabled by
 * design — and without this warning a teacher places one, publishes, and it stays that way forever
 * with nothing saying why.
 */
type Action = 'next_slide' | 'previous_slide' | 'replay_slide' | 'open_url'

const button = (action: Action, id = 'go') =>
  textElement({
    id,
    type: 'button',
    effects: [],
    payload: { label: 'Continue', action },
  })

const codes = (s: ReturnType<typeof slide>): string[] => collectProblems(s).map((p) => p.code)

describe('a navigation control that can never be operated', () => {
  it('is reported on a slide gated on an interaction', () => {
    const s = slide([textElement({ effects: [] }), button('next_slide')], {
      advance: { mode: 'after_interaction', interactionElementId: 'q' },
    })
    expect(codes(s)).toContain('NAVIGATION_INOPERABLE')
  })

  it('is reported on a slide gated on media', () => {
    const s = slide([textElement({ effects: [] }), button('next_slide')], {
      advance: { mode: 'after_media_ends', mediaElementId: 'v' },
    })
    expect(codes(s)).toContain('NAVIGATION_INOPERABLE')
  })

  it('is a warning, not an error', () => {
    /**
     * **The assertion that matters most here.** The slide is satisfiable through its own gate and
     * is not a dead end, so an error would refuse a perfectly publishable lesson — turning a note
     * about a stray button into a block on shipping.
     */
    expect(severityFor('NAVIGATION_INOPERABLE', 'semantic')).toBe('warning')
  })

  it('says nothing about Back or Replay on the same slide', () => {
    // Neither carries a learner past the gate; both move away from it, and a learner facing a
    // required question is precisely who wants them.
    const s = slide(
      [
        textElement({ effects: [] }),
        button('previous_slide', 'back'),
        button('replay_slide', 'again'),
      ],
      { advance: { mode: 'after_interaction', interactionElementId: 'q' } },
    )
    expect(codes(s)).not.toContain('NAVIGATION_INOPERABLE')
  })

  it('says nothing on a slide that continues when the learner asks', () => {
    // There the button is the mechanism, not a mistake.
    const s = slide([textElement({ effects: [] }), button('next_slide')], {
      advance: { mode: 'on_click' },
    })
    expect(codes(s)).not.toContain('NAVIGATION_INOPERABLE')
  })

  it('says nothing on a timed slide', () => {
    const s = slide([textElement({ effects: [] }), button('next_slide')], {
      advance: { mode: 'after_duration' },
    })
    expect(codes(s)).not.toContain('NAVIGATION_INOPERABLE')
  })
})
