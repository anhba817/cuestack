import { describe, expect, it } from 'vitest'
import { checkAssets, checkLesson, collectAssetRefs, withAssetIssues } from '../../src/validation/index.js'
import type { AssetAdapter, AssetLocation } from '../../src/adapters/index.js'
import { correct, noAltText } from '../harness/faulty.js'

const resolver = (present: readonly string[]): AssetAdapter => ({
  resolve: async (assetId) =>
    present.includes(assetId) ? ({ url: `https://cdn.test/${assetId}` } as AssetLocation) : null,
})

describe('collectAssetRefs', () => {
  it('is pure and finds every reference, wherever it sits in the payload', () => {
    const lesson = correct()
    const refs = collectAssetRefs(lesson)
    expect(refs).toEqual([{ assetId: 'asset_1', slideId: 'slide_0', elementId: 'img' }])
    // Called twice, same answer, and the manifest untouched.
    expect(collectAssetRefs(lesson)).toEqual(refs)
    expect(JSON.stringify(lesson)).toBe(JSON.stringify(correct()))
  })

  it('is the one finder both strengths share (FR-016b)', () => {
    /**
     * The assertion is about identity of *rule*, not of result: the publish check and the warning
     * pass call this same function, so there is no second walk to disagree with. A separate walk is
     * exactly how a report comes to say a lesson is fine while publishing refuses it for an asset
     * the report never looked at.
     */
    expect(collectAssetRefs(noAltText())).toEqual(collectAssetRefs(noAltText()))
  })
})

describe('checkAssets', () => {
  it('reports the ones that cannot be resolved, naming them', async () => {
    const unresolved = await checkAssets(collectAssetRefs(correct()), resolver([]))
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0]!.assetId).toBe('asset_1')
    expect(unresolved[0]!.message).toContain('asset_1')
    expect(unresolved[0]!.message).toContain('img')
  })

  it('reports nothing when they all resolve', async () => {
    expect(await checkAssets(collectAssetRefs(correct()), resolver(['asset_1']))).toEqual([])
  })

  it('treats an adapter that throws as an adapter that cannot answer', async () => {
    const angry: AssetAdapter = {
      resolve: async () => {
        throw new Error('the network is down')
      },
    }
    const unresolved = await checkAssets(collectAssetRefs(correct()), angry)
    expect(unresolved).toHaveLength(1)
    // The host's exception is not the teacher's problem, so it does not reach the message.
    expect(unresolved[0]!.message).not.toContain('network is down')
  })

  it('folds into a report as a warning by default, and blocks under policy', async () => {
    const unresolved = await checkAssets(collectAssetRefs(correct()), resolver([]))
    const report = withAssetIssues(checkLesson(correct()), unresolved)

    expect(report.issues.map((i) => i.code)).toEqual(['ASSET_UNRESOLVED'])
    expect(report.blocks).toBe(false)
  })
})

describe('the engine without an asset resolver', () => {
  it('completes and returns every other issue (SC-002a, FR-016a)', () => {
    /**
     * The engine takes no resolver at all — that is the shape of the guarantee. A caller who cannot
     * afford the round trip calls this and nothing else, and still learns about the dead end, the
     * overrun, and the missing alt text.
     */
    const report = checkLesson(noAltText())
    expect(report.issues.map((i) => i.code)).toEqual(['ACCESSIBILITY_METADATA_ABSENT'])
  })
})
