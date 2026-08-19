import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { attemptPublish, mountPublishing, resolvingAssets } from '../harness/publishing.js'
import { lessonWith, element } from '../harness/corpus.js'

afterEach(cleanup)

/** A question nobody can complete: `on_correct` with the attempts capped. */
const trapped = () =>
  lessonWith([
    element({
      id: 'q1',
      type: 'question',
      effects: [],
      payload: {
        interactionType: 'multiple_choice',
        prompt: 'Which one?',
        options: [
          { id: 'a', label: 'First' },
          { id: 'b', label: 'Second' },
        ],
        correctResponse: 'a',
        required: true,
        completionPolicy: 'on_correct',
        maxAttempts: 1,
      },
    }),
  ])

/** An image with no alt text: a warning, and warnings do not stop anything. */
const unlabelled = () =>
  lessonWith([
    element({
      id: 'img',
      type: 'image',
      effects: [],
      payload: { asset: { assetId: 'asset_1', mimeType: 'image/png' } },
    }),
  ])

describe('the publish gate', () => {
  it('refuses a lesson carrying an error, and names what stopped it', async () => {
    const { handle } = mountPublishing(trapped(), { assets: resolvingAssets() })
    const outcome = await attemptPublish(handle)

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe('invalid')
    expect(outcome.issues!.map((i) => i.code)).toContain('QUESTION_DEAD_END')
    expect(outcome.issues!.every((i) => i.severity === 'error')).toBe(true)
  })

  it('publishes nothing when it refuses', async () => {
    const { handle } = mountPublishing(trapped(), { assets: resolvingAssets() })
    await attemptPublish(handle)

    expect(handle.adapter.calls.some((c) => c.method === 'publish')).toBe(false)
    expect(await handle.adapter.listPublished('lesson')).toEqual([])
  })

  it('publishes a lesson whose only issues are warnings', async () => {
    const { handle } = mountPublishing(unlabelled(), { assets: resolvingAssets() })
    const outcome = await attemptPublish(handle)

    expect(outcome.ok).toBe(true)
    expect(handle.publishing.report!.issues.map((i) => i.severity)).toEqual(['warning'])
    expect(await handle.adapter.listPublished('lesson')).toHaveLength(1)
  })

  it('shows the errors rather than only reporting a refusal', async () => {
    const { handle, container } = mountPublishing(trapped(), { assets: resolvingAssets(), ui: true })
    await attemptPublish(handle)

    const blockers = container.querySelector('[data-cs-publish-blockers]')!
    expect(blockers.textContent).toContain('stuck')
    // And the shared vocabulary rather than a fifth word.
    expect(container.querySelector('.cs-save-status-word')!.textContent).toBe('Save Failed')
  })
})
