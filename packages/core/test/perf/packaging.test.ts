import { describe, expect, it } from 'vitest'
import { exportLesson, readPackage, importLesson } from '../../src/packaging/index.js'
import { largeLesson } from '../harness/large.js'

/**
 * SC-010, on the fixture the Constitution names — the same one features 005, 006, and 009 measure
 * against, so a number here is comparable with a number there.
 *
 * The budget is generous because nothing here runs during playback, seeking, or editing. What it
 * guards is the shape of the work: an export that walked the manifest once per asset rather than once
 * would still pass a small fixture and fail here.
 */
describe('packaging the 50-slide fixture', () => {
  it('exports in reference mode well inside three seconds', () => {
    const lesson = largeLesson()
    exportLesson(lesson, { kind: 'draft' }) // one warm pass, so the number is the work not the graph

    const started = performance.now()
    const pkg = exportLesson(lesson, { kind: 'draft' })
    const elapsed = performance.now() - started

    expect(pkg.lesson.slides.length).toBeGreaterThan(40)
    expect(elapsed).toBeLessThan(3000)
  })

  it('round-trips it inside the same budget', () => {
    const text = JSON.stringify(exportLesson(largeLesson(), { kind: 'draft' }))

    const started = performance.now()
    const read = readPackage(text)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    const imported = importLesson(read.package, { lessonId: 'mine' })
    const elapsed = performance.now() - started

    expect(imported.ok).toBe(true)
    expect(elapsed).toBeLessThan(3000)
  })
})
