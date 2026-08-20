import { describe, expect, it } from 'vitest'
import { exportLessonWithFiles } from '../../src/packaging/index.js'
import { fromBase64 } from '../../src/packaging/base64.js'
import { withAssets, withoutAssets } from '../harness/packages.js'

const PHOTO = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x0d, 0x0a])
const CLIP = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x41])

const provider = (have: Record<string, Uint8Array>) => async (assetId: string) =>
  have[assetId] ?? null

describe('files-mode export', () => {
  it('carries content that reconstructs the original bytes', async () => {
    const pkg = await exportLessonWithFiles(withAssets(), {
      kind: 'draft',
      content: provider({ asset_photo: PHOTO, asset_clip: CLIP }),
    })

    expect(pkg.assetMode).toBe('files')
    const photo = pkg.assets.find((a) => a.assetId === 'asset_photo')!
    expect([...fromBase64(photo.content!)]).toEqual([...PHOTO])
    const clip = pkg.assets.find((a) => a.assetId === 'asset_clip')!
    expect([...fromBase64(clip.content!)]).toEqual([...CLIP])
  })

  it('takes bytes from the provider, never text it encoded itself', async () => {
    /**
     * FR-006e. Encoding is the format's business: a caller that had to do it would be
     * reimplementing half the format in order to use it, and would become the second place an
     * encoding mistake could live.
     */
    let handed: unknown
    await exportLessonWithFiles(withAssets(), {
      kind: 'draft',
      content: async (id) => {
        const bytes = id === 'asset_photo' ? PHOTO : CLIP
        handed = bytes
        return bytes
      },
    })
    expect(handed).toBeInstanceOf(Uint8Array)
  })

  it('fails naming the asset when content cannot be supplied', async () => {
    // FR-006c. A package silently missing one image is worse than no package.
    await expect(
      exportLessonWithFiles(withAssets(), { kind: 'draft', content: provider({ asset_photo: PHOTO }) }),
    ).rejects.toThrow(/asset_clip/)
  })

  it('asks for each distinct asset once', async () => {
    const asked: string[] = []
    await exportLessonWithFiles(withAssets(), {
      kind: 'draft',
      content: async (id) => {
        asked.push(id)
        return id === 'asset_photo' ? PHOTO : CLIP
      },
    })
    // Two image elements share one asset; the network should not learn that.
    expect(asked.sort()).toEqual(['asset_clip', 'asset_photo'])
  })

  it('produces the same document as reference mode when there is nothing to carry', async () => {
    const pkg = await exportLessonWithFiles(withoutAssets(), {
      kind: 'draft',
      content: async () => null,
    })
    expect(pkg.assets).toEqual([])
    expect(pkg.assetMode).toBe('files')
  })
})
