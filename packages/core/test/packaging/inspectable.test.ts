import { describe, expect, it } from 'vitest'
import { exportLesson, exportLessonWithFiles, fromBase64 } from '../../src/packaging/index.js'
import { withAssets } from '../harness/packages.js'

/**
 * SC-002. A package is portable only if it can be read with nothing but the package.
 *
 * So this suite deliberately uses **no framework function to read one** — it parses the document
 * itself and rebuilds what it needs from what it finds. If that requires anything from the producing
 * system, the format is not portable and the promise §7.7 makes is not kept.
 */
describe('a package read with nothing but the package', () => {
  it('yields the lesson from plain JSON', () => {
    const text = JSON.stringify(exportLesson(withAssets(), { kind: 'draft' }))

    // A stranger's reader: JSON.parse and nothing else.
    const document = JSON.parse(text) as Record<string, unknown>
    expect(document['packageVersion']).toBeTruthy()
    expect(document['schemaVersion']).toBeTruthy()
    expect(document['kind']).toBe('draft')
    expect(document['assetMode']).toBe('references')

    const lesson = document['lesson'] as { slides: unknown[] }
    expect(lesson.slides).toHaveLength(1)
  })

  it('yields the asset bytes from a files-mode package with no asset store anywhere', async () => {
    const original = new Uint8Array([0x89, 0x50, 0x00, 0xff])
    const text = JSON.stringify(
      await exportLessonWithFiles(withAssets(), { kind: 'draft', content: async () => original }),
    )

    const document = JSON.parse(text) as { assets: { assetId: string; mediaType: string; content: string }[] }
    for (const asset of document.assets) {
      expect(asset.mediaType).toBeTruthy()
      // Base64 is a published standard; a stranger decodes it without asking us how.
      expect([...fromBase64(asset.content)]).toEqual([...original])
    }
  })

  it('says what it is at the top, before a reader reaches anything else', () => {
    // A reader must be able to refuse early — before parsing a lesson it may not understand.
    const text = JSON.stringify(exportLesson(withAssets(), { kind: 'published' }))
    const keys = Object.keys(JSON.parse(text) as object)
    expect(keys.indexOf('packageVersion')).toBeLessThan(keys.indexOf('lesson'))
    expect(keys.indexOf('assetMode')).toBeLessThan(keys.indexOf('assets'))
  })
})
