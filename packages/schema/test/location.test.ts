import { describe, expect, it } from 'vitest'
import { validate } from '../src/validate/index.js'
import { invalidFixtureNames, loadFixture, withReference } from './helpers.js'

/**
 * FR-003: every rejection identifies the slide, element, and field at fault,
 * without the caller having to parse the message to act on it.
 */
describe('issue location', () => {
  it.each(invalidFixtureNames())('%s carries a machine-readable path', (name) => {
    const result = validate(loadFixture(`invalid/${name}.json`))
    expect(result.ok).toBe(false)
    if (result.ok) return
    for (const issue of result.issues) {
      expect(Array.isArray(issue.path)).toBe(true)
      expect(issue.location).toBeDefined()
    }
  })

  it('resolves slide and element identity for an element-level fault', () => {
    const input = withReference((m) => {
      m.slides[1].elements[2].endMs = 1
    })
    const result = validate(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    const issue = result.issues.find((i) => i.code === 'TIMING_END_BEFORE_START')
    expect(issue).toBeDefined()
    expect(issue?.location.slideId).toBe('slide_media')
    expect(issue?.location.slideIndex).toBe(1)
    expect(issue?.location.elementId).toBe('element_worker')
    expect(issue?.location.elementIndex).toBe(2)
    expect(issue?.location.field).toBe('endMs')
  })

  it('resolves slide identity for a slide-level fault', () => {
    const input = withReference((m) => {
      m.slides[3].durationMs = -1
    })
    const result = validate(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    const issue = result.issues.find((i) => i.location.field === 'durationMs')
    expect(issue?.location.slideId).toBe('slide_wrap')
    expect(issue?.location.slideIndex).toBe(3)
    expect(issue?.location.elementId).toBeUndefined()
  })

  it('reports the offending key by name for an unknown field', () => {
    const input = withReference((m) => {
      m.slides[0].elements[0].learnerId = 'student_42'
    })
    const result = validate(input)
    expect(result.ok).toBe(false)
    if (result.ok) return
    const issue = result.issues.find((i) => i.code === 'UNKNOWN_FIELD')
    expect(issue?.location.field).toBe('learnerId')
    expect(issue?.location.elementId).toBe('element_title')
  })
})
