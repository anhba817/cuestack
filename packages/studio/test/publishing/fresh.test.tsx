import { act } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { attemptPublish, mountPublishing, resolvingAssets } from '../harness/publishing.js'
import { lessonWith, element } from '../harness/corpus.js'

afterEach(cleanup)

const fine = () => lessonWith([element({ id: 'a', effects: [], payload: { text: 'Hello' } })])

/**
 * FR-015: publishing validates immediately beforehand, and never trusts an earlier report.
 *
 * The failure this prevents is specific and quiet. A teacher runs the report, sees it clean, keeps
 * working, breaks something, and presses Publish — and a flow that reused the clean report would
 * publish the broken lesson while showing them the reason it should not have. A report costs a
 * millisecond; trusting a stale one costs a learner.
 */
describe('publishing revalidates', () => {
  it('refuses after the draft is edited into an invalid state', async () => {
    const { handle } = mountPublishing(fine(), { assets: resolvingAssets() })

    // A clean report first, exactly as a teacher would produce one.
    act(() => void handle.validation.run())
    expect(handle.validation.report!.blocks).toBe(false)

    // Then they break it, without running the report again.
    act(() =>
      void handle.session.apply({
        kind: 'set-field',
        id: 'a',
        path: ['payload', 'text'],
        value: '   ',
      }),
    )

    const outcome = await attemptPublish(handle)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('invalid')
    expect(outcome.issues!.map((i) => i.code)).toContain('TEXT_EMPTY')
  })

  it('does not reuse the report its own previous publish produced', async () => {
    /**
     * The gap a negative control found. The first two cases here compare against
     * `useValidation`'s report, which the publish flow never had access to anyway — so a flow that
     * cached its *own* report passed both. This is the case that actually bites: publish once
     * successfully, break the lesson, publish again. A cached report would say it is still fine.
     */
    const { handle } = mountPublishing(fine(), { assets: resolvingAssets() })
    expect((await attemptPublish(handle)).ok).toBe(true)
    expect(handle.publishing.report!.blocks).toBe(false)

    act(() =>
      void handle.session.apply({
        kind: 'set-field',
        id: 'a',
        path: ['payload', 'text'],
        value: '   ',
      }),
    )

    const second = await attemptPublish(handle)
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.reason).toBe('invalid')
    expect(second.issues!.map((i) => i.code)).toContain('TEXT_EMPTY')
    // And only one version exists, from the publish that was allowed.
    expect(await handle.adapter.listPublished('lesson')).toHaveLength(1)
  })

  it('does not reuse the held report object', async () => {
    const { handle } = mountPublishing(fine(), { assets: resolvingAssets() })
    act(() => void handle.validation.run())
    const stale = handle.validation.report

    await attemptPublish(handle)
    // The publish flow produced its own, and the panel's is untouched by it.
    expect(handle.publishing.report).not.toBe(stale)
  })

  it('saves first, then validates, and never reaches the adapter', async () => {
    const { handle } = mountPublishing(fine(), { assets: resolvingAssets() })
    act(() =>
      void handle.session.apply({
        kind: 'set-field',
        id: 'a',
        path: ['payload', 'text'],
        value: '',
      }),
    )

    await attemptPublish(handle)

    /**
     * The contract's order, asserted from both ends: the outstanding change reached storage
     * (step 1, FR-018a) and the adapter was never asked (step 3 refused first). A flow that
     * validated before saving would publish a lesson storage does not hold; one that published
     * before validating would publish the fault.
     */
    expect(handle.storage.saves).toHaveLength(1)
    expect(handle.storage.saves[0]!.manifest.slides[0]!.elements[0]!.payload).toEqual({ text: '' })
    expect(handle.adapter.calls).toEqual([])
  })
})
