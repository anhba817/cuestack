import { describe, expect, it } from 'vitest'
import { checkLesson } from '../../src/validation/index.js'
import { deadEnd, beyondSlide, noAltText } from '../harness/faulty.js'
import { lessonOf } from '../harness/lesson.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * FR-007: the order is part of the contract, so these compare **arrays** rather than sets.
 *
 * A report whose order moves between runs cannot be asserted, only sampled — and a teacher who
 * re-runs one after a fix has to find their place again instead of watching a line disappear.
 */
describe('the report is deterministic', () => {
  it('produces an identical array on a second run', () => {
    const lesson = noAltText()
    expect(checkLesson(lesson).issues).toEqual(checkLesson(lesson).issues)
  })

  it('orders slides, then elements, in document order', () => {
    const one = beyondSlide().slides[0]!
    const two = noAltText().slides[0]!
    const three = deadEnd().slides[0]!
    const lesson = {
      ...lessonOf({ slides: 1 }),
      slides: [
        { ...three, id: 'slide_a' },
        { ...one, id: 'slide_b' },
        { ...two, id: 'slide_c' },
      ],
    } as unknown as LessonManifest

    const slideIds = checkLesson(lesson).issues.map((issue) => issue.location.slideId)
    expect(slideIds).toEqual([...slideIds].sort())
    expect(new Set(slideIds)).toEqual(new Set(['slide_a', 'slide_b', 'slide_c']))
  })

  it('orders one element\'s issues by the source consulted, every time', () => {
    // An image that is both scheduled past its slide and missing alt text: the overrun comes from
    // `collectProblems` and the alt text from this engine, and the pair must not swap places.
    const lesson = noAltText()
    const slide = lesson.slides[0]!
    const withBoth = {
      ...lesson,
      slides: [{ ...slide, elements: [{ ...slide.elements[0]!, endMs: 12_000 }] }],
    } as unknown as LessonManifest

    const codes = checkLesson(withBoth).issues.map((i) => i.code)
    expect(codes).toEqual(['ELEMENT_BEYOND_SLIDE', 'ACCESSIBILITY_METADATA_ABSENT'])
    expect(checkLesson(withBoth).issues.map((i) => i.code)).toEqual(codes)
  })
})
