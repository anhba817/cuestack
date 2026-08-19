import { describe, expect, it } from 'vitest'
import { checkAssets, collectAssetRefs } from '../../src/validation/index.js'
import type { AssetAdapter, AssetLocation } from '../../src/adapters/index.js'
import { correct } from '../harness/faulty.js'

const resolver = (present: readonly string[]): AssetAdapter => ({
  resolve: async (assetId) =>
    present.includes(assetId) ? ({ url: `https://cdn.test/${assetId}` } as AssetLocation) : null,
})

/**
 * BR-018: a published package references only assets that resolve.
 *
 * The rule is about what the *published* package points at, which is why the publish check runs
 * its own resolution rather than reusing the report's. An asset present when the report ran may be
 * gone now — that possibility is the entire reason the check exists at both moments — and a
 * publish that trusted the earlier answer would enshrine it in something nothing can edit.
 */
describe('BR-018', () => {
  it('finds the reference a published package would carry', () => {
    expect(collectAssetRefs(correct()).map((r) => r.assetId)).toEqual(['asset_1'])
  })

  it('names the asset that cannot be resolved', async () => {
    const unresolved = await checkAssets(collectAssetRefs(correct()), resolver([]))
    expect(unresolved.map((u) => u.assetId)).toEqual(['asset_1'])
    // Named, so a teacher can go and find it rather than searching the whole lesson.
    expect(unresolved[0]!.message).toContain('asset_1')
    expect(unresolved[0]!.elementId).toBe('img')
    expect(unresolved[0]!.slideId).toBe('slide_0')
  })

  it('is satisfied when every reference resolves', async () => {
    expect(await checkAssets(collectAssetRefs(correct()), resolver(['asset_1']))).toEqual([])
  })

  it('asks the resolver again rather than caching an answer', async () => {
    /**
     * Two calls, two answers, because the world changed in between. A cache here would make the
     * publish check a restatement of the report rather than an independent question.
     */
    const asked: string[] = []
    let present = true
    const flaky: AssetAdapter = {
      resolve: async (assetId) => {
        asked.push(assetId)
        return present ? ({ url: 'https://cdn.test/x' } as AssetLocation) : null
      },
    }
    const refs = collectAssetRefs(correct())

    expect(await checkAssets(refs, flaky)).toEqual([])
    present = false
    expect(await checkAssets(refs, flaky)).toHaveLength(1)
    expect(asked).toEqual(['asset_1', 'asset_1'])
  })

  it('resolves each distinct id once, however often it appears', async () => {
    const lesson = correct()
    const slide = lesson.slides[0]!
    const twice = {
      ...lesson,
      slides: [
        {
          ...slide,
          elements: [...slide.elements, { ...slide.elements[1]!, id: 'img2' }],
        },
      ],
    } as typeof lesson

    const asked: string[] = []
    const counting: AssetAdapter = {
      resolve: async (assetId) => {
        asked.push(assetId)
        return null
      },
    }

    const unresolved = await checkAssets(collectAssetRefs(twice), counting)
    // Asked once, reported twice: the teacher needs both places, the network does not.
    expect(asked).toEqual(['asset_1'])
    expect(unresolved.map((u) => u.elementId)).toEqual(['img', 'img2'])
  })
})
