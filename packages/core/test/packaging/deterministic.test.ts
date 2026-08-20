import { describe, expect, it } from 'vitest'
import { exportLesson } from '../../src/packaging/index.js'
import { withAssets, withoutAssets } from '../harness/packages.js'

/**
 * SC-002b. If two callers can produce two documents from one lesson, the package's form is a
 * property of who asked rather than of the framework — and "the framework fixes the format" is
 * untrue, which puts two systems back to producing two formats.
 */
describe('two exports of one lesson', () => {
  for (const [name, make] of [
    ['a lesson with assets', withAssets],
    ['a lesson with none', withoutAssets],
  ] as const) {
    it(`are byte-identical for ${name}`, () => {
      const lesson = make()
      expect(JSON.stringify(exportLesson(lesson, { kind: 'draft' }))).toBe(
        JSON.stringify(exportLesson(lesson, { kind: 'draft' })),
      )
    })
  }

  it('order the asset inventory the same way every time', () => {
    // A Set or a Map iteration order that happened to be stable would pass a single run; this
    // compares the arrays across separately constructed lessons.
    const a = exportLesson(withAssets(), { kind: 'draft' }).assets.map((x) => x.assetId)
    const b = exportLesson(withAssets(), { kind: 'draft' }).assets.map((x) => x.assetId)
    expect(a).toEqual(b)
  })

  it('put the document keys in one order', () => {
    expect(Object.keys(exportLesson(withAssets(), { kind: 'draft' }))).toEqual(
      Object.keys(exportLesson(withoutAssets(), { kind: 'published' })),
    )
  })
})
