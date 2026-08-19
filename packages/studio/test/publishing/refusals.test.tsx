import { act } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { attemptPublish, mountPublishing, resolvingAssets } from '../harness/publishing.js'
import { lessonWith, element } from '../harness/corpus.js'

afterEach(cleanup)

const fine = () => lessonWith([element({ id: 'a', effects: [], payload: { text: 'Hello' } })])

const withImage = () =>
  lessonWith([
    element({
      id: 'img',
      type: 'image',
      effects: [],
      payload: { asset: { assetId: 'asset_1', mimeType: 'image/png' } },
      accessibility: { altText: 'A diagram' },
    }),
  ])

/**
 * Four ways a publish does not happen, and the requirement is that they are four.
 *
 * FR-017 makes "changes nothing" a requirement rather than a consequence, and SC-012 measures it
 * across every path. The second half matters as much: a teacher told "could not publish" about a
 * network failure searches their lesson for a fault that is not there — and finds one, because
 * every lesson has something. Each refusal must say something the others do not.
 */
describe('every refusal', () => {
  it('validation errors: nothing published, draft untouched', async () => {
    const { handle } = mountPublishing(
      lessonWith([element({ id: 'a', effects: [], payload: { text: '  ' } })]),
      { assets: resolvingAssets() },
    )
    const before = JSON.stringify(handle.session.draft)

    const outcome = await attemptPublish(handle)
    expect(outcome.ok).toBe(false)
    expect(JSON.stringify(handle.session.draft)).toBe(before)
    expect(await handle.adapter.listPublished('lesson')).toEqual([])
  })

  it('an unresolvable asset: nothing published, draft untouched, the file named', async () => {
    const { handle } = mountPublishing(withImage(), { assets: resolvingAssets([]) })
    const before = JSON.stringify(handle.session.draft)

    const outcome = await attemptPublish(handle)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('assets')
    expect(outcome.assetIds).toEqual(['asset_1'])
    expect(JSON.stringify(handle.session.draft)).toBe(before)
    expect(handle.adapter.calls.some((c) => c.method === 'publish')).toBe(false)
  })

  it('a permission refusal: nothing published, draft untouched', async () => {
    const { handle } = mountPublishing(fine(), { assets: resolvingAssets() })
    handle.adapter.refuseWith('permission')
    const before = JSON.stringify(handle.session.draft)

    const outcome = await attemptPublish(handle)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('permission')
    expect(JSON.stringify(handle.session.draft)).toBe(before)
    expect(await handle.adapter.listPublished('lesson')).toEqual([])
  })

  it('a save that could not land: nothing published, draft untouched', async () => {
    const { handle } = mountPublishing(fine(), { assets: resolvingAssets() })
    act(() =>
      void handle.session.apply({
        kind: 'set-field',
        id: 'a',
        path: ['payload', 'text'],
        value: 'Changed',
      }),
    )
    handle.storage.fail('unavailable')
    const before = JSON.stringify(handle.session.draft)

    const outcome = await attemptPublish(handle)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('save-failed')
    expect(JSON.stringify(handle.session.draft)).toBe(before)
    expect(handle.adapter.calls).toEqual([])
  })

  it('says four different things', async () => {
    const messages = new Set<string>()

    const invalid = mountPublishing(
      lessonWith([element({ id: 'a', effects: [], payload: { text: '  ' } })]),
      { assets: resolvingAssets() },
    )
    messages.add(((await attemptPublish(invalid.handle)) as { message: string }).message)
    cleanup()

    const assets = mountPublishing(withImage(), { assets: resolvingAssets([]) })
    messages.add(((await attemptPublish(assets.handle)) as { message: string }).message)
    cleanup()

    const denied = mountPublishing(fine(), { assets: resolvingAssets() })
    denied.handle.adapter.refuseWith('permission')
    messages.add(((await attemptPublish(denied.handle)) as { message: string }).message)
    cleanup()

    const unsaved = mountPublishing(fine(), { assets: resolvingAssets() })
    act(() =>
      void unsaved.handle.session.apply({
        kind: 'set-field',
        id: 'a',
        path: ['payload', 'text'],
        value: 'Changed',
      }),
    )
    unsaved.handle.storage.fail('unavailable')
    messages.add(((await attemptPublish(unsaved.handle)) as { message: string }).message)

    expect(messages.size).toBe(4)
    // And none of them is a bare code.
    for (const message of messages) expect(message.length).toBeGreaterThan(40)
  })

  it("distinguishes the network from the lesson, in words", async () => {
    const { handle } = mountPublishing(fine(), { assets: resolvingAssets() })
    handle.adapter.refuseWith('unavailable')
    const outcome = (await attemptPublish(handle)) as { message: string }

    expect(outcome.message).toMatch(/unreachable|try again/i)
    // Nothing that would send a teacher looking through their slides.
    expect(outcome.message).not.toMatch(/error|fix/i)
  })
})
