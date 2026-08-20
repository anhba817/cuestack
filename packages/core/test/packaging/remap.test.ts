import { describe, expect, it } from 'vitest'
import { exportLessonWithFiles, importLesson, readPackage, collectAssetRefs } from '../../src/packaging/index.js'
import { withAssets } from '../harness/packages.js'

const filesPackage = async () => {
  const text = JSON.stringify(
    await exportLessonWithFiles(withAssets(), {
      kind: 'draft',
      content: async () => new Uint8Array([1, 2, 3]),
    }),
  )
  const read = readPackage(text)
  if (!read.ok) throw new Error('unreachable')
  return read.package
}

describe('asset identity on import', () => {
  it('rewrites references to where the host actually stored them', async () => {
    /**
     * SC-005b. Most asset stores mint their own identifiers, so this store deliberately assigns
     * ones unlike the package's. A lesson pointing at the exporting system's ids is a lesson whose
     * every image is blank while its manifest remains perfectly valid — a failure nothing reports.
     */
    const pkg = await filesPackage()
    const result = importLesson(pkg, {
      lessonId: 'mine',
      assets: new Map([
        ['asset_photo', 'store-9931'],
        ['asset_clip', 'store-9932'],
      ]),
    })
    if (!result.ok) throw new Error('unreachable')

    const ids = collectAssetRefs(result.lesson).map((r) => r.assetId)
    expect(new Set(ids)).toEqual(new Set(['store-9931', 'store-9932']))
    expect(ids).not.toContain('asset_photo')
    expect(result.unresolvedAssets).toEqual([])
  })

  it('rewrites every reference to a shared asset, not the first', async () => {
    /**
     * The fixture has two image elements sharing `asset_photo`. A rewriter that stopped at the
     * first match would leave the second pointing at an id the host never stored — and the manifest
     * would still be perfectly valid, so nothing would say so.
     */
    const pkg = await filesPackage()
    const result = importLesson(pkg, {
      lessonId: 'mine',
      assets: new Map([['asset_photo', 'store-9931'], ['asset_clip', 'store-9932']]),
    })
    if (!result.ok) throw new Error('unreachable')

    const photoRefs = collectAssetRefs(result.lesson).filter((r) => r.assetId === 'store-9931')
    expect(photoRefs.map((r) => r.elementId).sort()).toEqual(['img_a', 'img_b'])
  })

  it('keeps an unmapped reference and reports it', async () => {
    /**
     * FR-014c. Not dropped, because deleting a teacher's image because a store refused it is worse
     * than telling them; and not silently kept, because a reference nobody can follow is the
     * failure the mapping exists to prevent.
     */
    const pkg = await filesPackage()
    const result = importLesson(pkg, {
      lessonId: 'mine',
      assets: new Map([['asset_photo', 'store-9931']]),
    })
    if (!result.ok) throw new Error('unreachable')

    expect(result.unresolvedAssets).toEqual(['asset_clip'])
    const ids = collectAssetRefs(result.lesson).map((r) => r.assetId)
    expect(ids).toContain('store-9931')
    expect(ids).toContain('asset_clip')
  })

  it('produces the lesson for a reference-mode package with no mapping at all', async () => {
    /**
     * FR-006d, and the ordinary case rather than an error: a reference-mode package imported into a
     * system that has never held those assets still yields the lesson, with every reference
     * reported unresolved.
     */
    const { exportLesson } = await import('../../src/packaging/index.js')
    const read = readPackage(JSON.stringify(exportLesson(withAssets(), { kind: 'draft' })))
    if (!read.ok) throw new Error('unreachable')

    const result = importLesson(read.package, { lessonId: 'mine' })
    if (!result.ok) throw new Error('unreachable')
    expect([...result.unresolvedAssets].sort()).toEqual(['asset_clip', 'asset_photo'])
    expect(result.lesson.slides).toHaveLength(1)
  })
})
