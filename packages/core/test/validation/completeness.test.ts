import { describe, expect, it } from 'vitest'
import { checkLesson } from '../../src/validation/index.js'
import { correct, deadEnd, noAltText } from '../harness/faulty.js'
import { lessonOf } from '../harness/lesson.js'
import type { LessonManifest } from '@cuestack/schema'

describe('one pass, every issue', () => {
  it('reports all of them rather than the first (FR-001)', () => {
    const base = lessonOf({ slides: 1 })
    const lesson = {
      ...base,
      slides: [deadEnd().slides[0]!, noAltText().slides[0]!].map((slide, index) => ({
        ...slide,
        id: `slide_${index}`,
      })),
    } as unknown as LessonManifest

    const codes = checkLesson(lesson).issues.map((i) => i.code)
    expect(codes).toContain('QUESTION_DEAD_END')
    expect(codes).toContain('ACCESSIBILITY_METADATA_ABSENT')
  })

  it('says so plainly when nothing is wrong (FR-011)', () => {
    const report = checkLesson(correct())
    expect(report.issues).toEqual([])
    expect(report.blocks).toBe(false)
  })

  it('leaves the manifest byte-identical (FR-012)', () => {
    const lesson = deadEnd()
    const before = JSON.stringify(lesson)
    checkLesson(lesson)
    expect(JSON.stringify(lesson)).toBe(before)
  })

  it('blocks when any issue is an error, and not when every one is a warning', () => {
    expect(checkLesson(deadEnd()).blocks).toBe(true)
    expect(checkLesson(noAltText()).blocks).toBe(false)
    expect(checkLesson(noAltText()).issues.every((i) => i.severity === 'warning')).toBe(true)
  })
})
