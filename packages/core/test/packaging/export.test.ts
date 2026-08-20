import { describe, expect, it } from 'vitest'
import { exportLesson } from '../../src/packaging/index.js'
import { PACKAGE_FORMAT_VERSION } from '../../src/packaging/format.js'
import { withAssets, withoutAssets } from '../harness/packages.js'
import type { LessonManifest } from '@cuestack/schema'

describe('what an exported document carries', () => {
  it('carries the lesson unmodified', () => {
    const lesson = withAssets()
    const pkg = exportLesson(lesson, { kind: 'draft' })
    expect(pkg.lesson).toEqual(lesson)
  })

  it('carries both version fields, and reads the lesson version from the lesson', () => {
    /**
     * FR-003: the two move for different reasons — a new element type moves the lesson format, a
     * new package field moves this one — so a document conflating them could not describe a future
     * in which either moved alone. Asserted by giving the lesson a version of its own and watching
     * only one of the two fields follow it.
     */
    // `schemaVersion` is a literal type pinned to the current version, so an older one is
    // constructed past it deliberately — the same reason `syntheticElement` exists.
    const lesson = { ...withoutAssets(), schemaVersion: '0.9' } as unknown as LessonManifest
    const pkg = exportLesson(lesson, { kind: 'draft' })

    expect(pkg.schemaVersion).toBe('0.9')
    expect(pkg.packageVersion).toBe(PACKAGE_FORMAT_VERSION)
    expect(pkg.packageVersion).not.toBe(pkg.schemaVersion)
  })

  it('records which kind it was, because a reader cannot ask the manifest', () => {
    expect(exportLesson(withoutAssets(), { kind: 'draft' }).kind).toBe('draft')
    expect(exportLesson(withoutAssets(), { kind: 'published' }).kind).toBe('published')
  })

  it('takes the kind from the caller rather than guessing', () => {
    /**
     * FR-004d. The framework cannot tell a draft manifest from a published one — they are the same
     * shape — so `kind` is something the caller states. A package claiming to be a published lesson
     * when it was a draft is a lie a teacher has no way to detect.
     */
    const lesson = withoutAssets()
    expect(exportLesson(lesson, { kind: 'published' }).lesson).toEqual(
      exportLesson(lesson, { kind: 'draft' }).lesson,
    )
  })

  it('defaults to reference mode and says so', () => {
    expect(exportLesson(withAssets(), { kind: 'draft' }).assetMode).toBe('references')
  })

  it('states the mode at the top, before a reader reaches the assets', () => {
    // FR-006a: a reader that could not tell the modes apart would treat an incomplete package as
    // complete, which is the failure the distinction exists to prevent.
    const pkg = exportLesson(withAssets(), { kind: 'draft' })
    expect(Object.keys(pkg)).toContain('assetMode')
    expect(pkg.assets.every((a) => a.content === undefined)).toBe(true)
  })
})
