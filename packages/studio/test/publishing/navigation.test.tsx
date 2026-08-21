import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { attemptPublish, mountPublishing, resolvingAssets } from '../harness/publishing.js'
import { lessonWith, element } from '../harness/corpus.js'

afterEach(cleanup)

/**
 * FR-011 — a lesson nobody can finish is refused before it reaches anybody.
 *
 * A slide set to continue when the learner asks, with nothing for them to ask with. Validation
 * used to pass this: the premise was that a learner can always click, and nothing raised the
 * signal, so every learner stopped there permanently and no problem was reported.
 */
const noWayForward = () =>
  lessonWith([element({ id: 'text', effects: [] })], { advance: { mode: 'on_click' } })

/** The same slide with a Back button — a dead end going forwards, and the easier mistake. */
const backwardsOnly = () =>
  lessonWith(
    [
      element({ id: 'text', effects: [] }),
      element({
        id: 'back',
        type: 'button',
        effects: [],
        payload: { label: 'Back', action: 'previous_slide' },
      }),
    ],
    { advance: { mode: 'on_click' } },
  )

/** Satisfiable: the control moves the learner forward. */
const withContinue = () =>
  lessonWith(
    [
      element({ id: 'text', effects: [] }),
      element({
        id: 'go',
        type: 'button',
        effects: [],
        payload: { label: 'Continue', action: 'next_slide' },
      }),
    ],
    { advance: { mode: 'on_click' } },
  )

describe('publishing a lesson a learner could not finish', () => {
  it('refuses a slide that waits for the learner with no way forward', async () => {
    const { handle } = mountPublishing(noWayForward(), { assets: resolvingAssets() })
    const outcome = await attemptPublish(handle)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.issues!.map((i) => i.code)).toContain('ADVANCE_UNSATISFIABLE')
  })

  it('refuses one whose only control points backwards', async () => {
    const { handle } = mountPublishing(backwardsOnly(), { assets: resolvingAssets() })
    const outcome = await attemptPublish(handle)

    expect(outcome.ok, 'a Back button is not a way forward').toBe(false)
  })

  it('publishes one a learner can actually leave', async () => {
    // The check must not cry wolf: a satisfiable slide is publishable, and a rule that refused
    // this would refuse the shape the feature exists to make work.
    const { handle } = mountPublishing(withContinue(), { assets: resolvingAssets() })
    const outcome = await attemptPublish(handle)
    expect(outcome.ok).toBe(true)
  })
})
