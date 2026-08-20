import { describe, expect, it } from 'vitest'
import { exportLesson, exportLessonWithFiles, importLesson, readPackage } from '../../src/packaging/index.js'
import { withAssets, withAddress, withoutAssets } from '../harness/packages.js'
import { correct } from '../harness/faulty.js'
import { largeLesson } from '../harness/large.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * SC-001, and the whole feature in one assertion.
 *
 * If every lesson in the corpus survives the trip, it is difficult for the rest of export or import
 * to be very wrong. The one permitted difference is the identity the caller supplied — which is not
 * a loss but the point (FR-015a).
 */
const CORPUS: [string, () => LessonManifest][] = [
  ['a lesson with assets', withAssets],
  ['a lesson with none', withoutAssets],
  ['a lesson with an address', withAddress],
  ['the validation control', correct],
  ['the 50-slide fixture', largeLesson],
]

const sameExceptId = (before: LessonManifest, after: LessonManifest): void => {
  expect({ ...after, lesson: { ...after.lesson, id: before.lesson.id } }).toEqual(before)
}

describe('export then import', () => {
  for (const [name, make] of CORPUS) {
    it(`returns ${name} unchanged`, () => {
      const original = make()
      const text = JSON.stringify(exportLesson(original, { kind: 'draft' }))

      const read = readPackage(text)
      expect(read.ok).toBe(true)
      if (!read.ok) return

      const imported = importLesson(read.package, { lessonId: 'freshly_minted' })
      expect(imported.ok).toBe(true)
      if (!imported.ok) return

      sameExceptId(original, imported.lesson)
      expect(imported.lesson.lesson.id).toBe('freshly_minted')
    })
  }

  it('returns a files-mode package unchanged too', async () => {
    const original = withAssets()
    const bytes = new Uint8Array([1, 2, 3, 0, 255])
    const text = JSON.stringify(
      await exportLessonWithFiles(original, { kind: 'draft', content: async () => bytes }),
    )

    const read = readPackage(text)
    if (!read.ok) throw new Error('unreachable')
    // The assets came back as bytes rather than as text the host would have to decode (FR-006e).
    expect(read.package.assets.every((a) => a.content instanceof Uint8Array)).toBe(true)

    const imported = importLesson(read.package, {
      lessonId: 'freshly_minted',
      assets: new Map([
        ['asset_photo', 'asset_photo'],
        ['asset_clip', 'asset_clip'],
      ]),
    })
    if (!imported.ok) throw new Error('unreachable')
    sameExceptId(original, imported.lesson)
  })

  it('preserves the kind through the trip', () => {
    const text = JSON.stringify(exportLesson(withoutAssets(), { kind: 'published' }))
    const read = readPackage(text)
    if (!read.ok) throw new Error('unreachable')
    expect(read.package.kind).toBe('published')
  })
})
