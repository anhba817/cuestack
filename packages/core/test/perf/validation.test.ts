import { describe, expect, it } from 'vitest'
import { checkLesson } from '../../src/validation/index.js'
import { largeLesson } from '../harness/large.js'

/**
 * SC-004's budget, measured on the fixture the Constitution names.
 *
 * A validation report a teacher waits for is one they run less often, and a check they skip is a
 * check that is not there. The engine is pure and synchronous, so this measures the arrangement
 * itself rather than any I/O.
 */
describe('the engine on 50 slides and 300 elements', () => {
  it('reports in well under a second', () => {
    const lesson = largeLesson()
    // One warm pass, so the number is the engine rather than the module graph.
    checkLesson(lesson)

    const started = performance.now()
    const report = checkLesson(lesson)
    const elapsed = performance.now() - started

    expect(report.issues).toBeDefined()
    expect(elapsed).toBeLessThan(1000)
  })
})
