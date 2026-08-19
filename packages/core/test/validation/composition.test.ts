import { describe, expect, it } from 'vitest'
import { checkLesson } from '../../src/validation/index.js'
import { checkReachability } from '../../src/advance/reachability.js'
import { collectProblems } from '../../src/resolve/problems.js'
import { advanceOnNonMedia, beyondSlide, correct } from '../harness/faulty.js'
import type { Slide } from '@cuestack/schema'

/**
 * The engine delegates, and these assertions are about *whose* answer arrives.
 *
 * Each case asks the underlying validator directly and asserts the report carries that exact code
 * and that exact message. The failure being guarded against is not a missing check — it is the
 * engine growing a fourth opinion, quietly rewording or re-deciding what an existing validator
 * already says, so that the report and the player come to disagree (research R-01).
 */
describe('the engine composes rather than re-decides', () => {
  it('reports the advance code checkReachability itself produces', () => {
    const lesson = advanceOnNonMedia()
    const direct = checkReachability(lesson.slides[0] as Slide)
    expect(direct).not.toBeNull()

    const found = checkLesson(lesson).issues.find((i) => i.source === 'semantic' && i.code === direct!.code)
    expect(found).toBeDefined()
    expect(found!.message).toBe(direct!.message)
    expect(found!.location.slideId).toBe('slide_0')
    expect(found!.location.elementId).toBe('notMedia')
  })

  it('reports the overrun code collectProblems itself produces', () => {
    const lesson = beyondSlide()
    const direct = collectProblems(lesson.slides[0] as Slide)
    expect(direct).toHaveLength(1)

    const found = checkLesson(lesson).issues.find((i) => i.code === 'ELEMENT_BEYOND_SLIDE')
    expect(found).toBeDefined()
    expect(found!.message).toBe(direct[0]!.message)
    expect(found!.severity).toBe('warning')
  })

  it("carries the schema's own codes, as errors, under source 'schema'", () => {
    const broken = { schemaVersion: '1.0', lesson: { id: 'x' } }
    const report = checkLesson(broken)

    expect(report.issues.length).toBeGreaterThan(0)
    expect(report.issues.every((i) => i.source === 'schema')).toBe(true)
    expect(report.issues.every((i) => i.severity === 'error')).toBe(true)
    expect(report.blocks).toBe(true)
  })

  it('finds nothing at all in the control', () => {
    const report = checkLesson(correct())
    expect(report.issues).toEqual([])
    expect(report.blocks).toBe(false)
  })
})
