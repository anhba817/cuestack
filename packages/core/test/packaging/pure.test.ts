import { describe, expect, it } from 'vitest'
import { exportLesson } from '../../src/packaging/index.js'
import { withAssets } from '../harness/packages.js'

/**
 * SC-002a is a structural claim rather than a time bound.
 *
 * Reference mode is the default precisely because it is the one a teacher can ask for without
 * consequence. An export that awaited anything would have acquired a dependency on the outside world
 * that the default must not have — and the way to assert that is not to measure how long it took,
 * but to observe that it returned a value rather than a promise, with no provider in existence.
 */
describe('reference-mode export', () => {
  it('returns a document rather than a promise', () => {
    const result = exportLesson(withAssets(), { kind: 'draft' })
    expect(result).not.toBeInstanceOf(Promise)
    expect(result.assets.length).toBeGreaterThan(0)
  })

  it('needs no content provider at all', () => {
    // Not "a provider that returns nothing" — no provider argument whatsoever.
    expect(() => exportLesson(withAssets(), { kind: 'draft' })).not.toThrow()
  })

  it('names every asset without carrying any', () => {
    const pkg = exportLesson(withAssets(), { kind: 'draft' })
    expect(pkg.assets.map((a) => a.assetId).sort()).toEqual(['asset_clip', 'asset_photo'])
    expect(pkg.assets.every((a) => !('content' in a) || a.content === undefined)).toBe(true)
  })

  it('leaves the lesson byte-identical', () => {
    const lesson = withAssets()
    const before = JSON.stringify(lesson)
    exportLesson(lesson, { kind: 'draft' })
    expect(JSON.stringify(lesson)).toBe(before)
  })
})
