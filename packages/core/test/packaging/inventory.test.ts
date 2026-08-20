import { describe, expect, it } from 'vitest'
import { exportLesson } from '../../src/packaging/index.js'
import { withAssets, withoutAssets } from '../harness/packages.js'

describe('the asset inventory', () => {
  it('lists each distinct asset once, however many elements reference it', () => {
    /**
     * FR-009. The fixture has two image elements sharing one asset and a third element with
     * another — a corpus where every asset is referenced once could not show this.
     */
    const pkg = exportLesson(withAssets(), { kind: 'draft' })
    expect(pkg.assets).toHaveLength(2)
    expect(new Set(pkg.assets.map((a) => a.assetId)).size).toBe(2)
  })

  it('carries a media type on every entry', () => {
    // Stored, never inferred: an asset id says nothing about what the bytes are, and a reader that
    // guessed would guess wrong on the first file without an extension (data-model §3).
    const pkg = exportLesson(withAssets(), { kind: 'draft' })
    expect(pkg.assets.every((a) => typeof a.mediaType === 'string' && a.mediaType.length > 0)).toBe(true)
    expect(pkg.assets.find((a) => a.assetId === 'asset_photo')!.mediaType).toBe('image/png')
    expect(pkg.assets.find((a) => a.assetId === 'asset_clip')!.mediaType).toBe('audio/mpeg')
  })

  it('is an empty list rather than an absent one when a lesson has no assets', () => {
    const pkg = exportLesson(withoutAssets(), { kind: 'draft' })
    expect(pkg.assets).toEqual([])
  })

  it('finds an asset wherever it sits, rather than where a list of paths expected it', () => {
    const lesson = withoutAssets()
    const slide = lesson.slides[0]!
    const nested = {
      ...lesson,
      slides: [
        {
          ...slide,
          elements: [
            {
              ...slide.elements[0]!,
              type: 'video',
              payload: {
                asset: { assetId: 'deep_a', mimeType: 'video/mp4' },
                poster: 'ignored_string',
                captions: { track: { asset: { assetId: 'deep_b', mimeType: 'text/vtt' } } },
              },
            },
          ],
        },
      ],
    } as unknown as typeof lesson

    const found = exportLesson(nested, { kind: 'draft' }).assets.map((a) => a.assetId)
    expect(found).toContain('deep_a')
    expect(found).toContain('deep_b')
  })
})
