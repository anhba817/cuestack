import { describe, expect, it } from 'vitest'
import { exportLesson, importLesson, readPackage } from '../../src/packaging/index.js'
import { withAssets, withoutAssets } from '../harness/packages.js'
import type { ImportedPackage } from '../../src/packaging/index.js'

const read = (manifest = withoutAssets()): ImportedPackage => {
  const r = readPackage(JSON.stringify(exportLesson(manifest, { kind: 'draft' })))
  if (!r.ok) throw new Error('unreachable')
  return r.package
}

describe('identity on import', () => {
  it("discards the package's lesson id for the caller's", () => {
    /**
     * FR-015a. A package's id belongs to whatever system produced it, and honouring it would let a
     * package sent by a stranger land on top of an unrelated lesson that happens to share it.
     */
    const result = importLesson(read(), { lessonId: 'mine' })
    if (!result.ok) throw new Error('unreachable')
    expect(result.lesson.lesson.id).toBe('mine')
    expect(result.lesson.lesson.id).not.toBe(withoutAssets().lesson.id)
  })

  it('leaves identifiers within the lesson alone', () => {
    /**
     * FR-015b. Slide, element, and effect ids are unique only within their lesson, so they need no
     * re-minting — and rewriting them would mean rewriting every reference that points at one,
     * including a question's correct answer.
     */
    const original = withAssets()
    const result = importLesson(read(original), { lessonId: 'mine' })
    if (!result.ok) throw new Error('unreachable')

    expect(result.lesson.slides.map((s) => s.id)).toEqual(original.slides.map((s) => s.id))
    expect(result.lesson.slides[0]!.elements.map((e) => e.id)).toEqual(
      original.slides[0]!.elements.map((e) => e.id),
    )
  })

  it('yields two independent lessons when imported twice with two identities', () => {
    // SC-005a. The framework's answer; a host holding one lesson supplies one identity twice and
    // gets a replacement, which is the same rule producing a different outcome.
    const pkg = read()
    const a = importLesson(pkg, { lessonId: 'first' })
    const b = importLesson(pkg, { lessonId: 'second' })
    if (!a.ok || !b.ok) throw new Error('unreachable')

    expect(a.lesson.lesson.id).toBe('first')
    expect(b.lesson.lesson.id).toBe('second')
    expect(a.lesson).not.toBe(b.lesson)
  })

  it('does not modify the package it was given', () => {
    const pkg = read()
    const before = JSON.stringify(pkg)
    importLesson(pkg, { lessonId: 'mine' })
    expect(JSON.stringify(pkg)).toBe(before)
  })
})
