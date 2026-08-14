import { describe, expect, it } from 'vitest'
import { validate } from '../src/validate/index.js'
import { withReference } from './helpers.js'

/**
 * US1 #7 / FR-019. Rejecting is the only option that keeps both guarantees:
 * silently preserving would let a host smuggle learner identifiers into a
 * lesson; silently stripping would break the round-trip promise.
 */
describe('unknown fields', () => {
  const sites: Array<[string, (m: any) => void]> = [
    ['root', (m) => { m.learnerId = 'student_42' }],
    ['lesson meta', (m) => { m.lesson.learnerId = 'student_42' }],
    ['slide', (m) => { m.slides[0].learnerId = 'student_42' }],
    ['element', (m) => { m.slides[0].elements[0].learnerId = 'student_42' }],
    ['effect', (m) => { m.slides[0].elements[0].effects[0].learnerId = 'x' }],
    ['payload', (m) => { m.slides[0].elements[0].payload.learnerId = 'x' }],
    ['interaction', (m) => { m.slides[2].elements[0].payload.learnerId = 'x' }],
  ]

  it.each(sites)('rejects an unknown field at %s', (_label, mutate) => {
    const result = validate(withReference(mutate))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((i) => i.code)).toContain('UNKNOWN_FIELD')
  })

  it('does not strip and does not preserve — it refuses', () => {
    const result = validate(withReference((m) => { m.lesson.learnerId = 'student_42' }))
    expect(result.ok).toBe(false)
  })

  it('names the offending key', () => {
    const result = validate(withReference((m) => { m.lesson.trackingPixel = 'x' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    const issue = result.issues.find((i) => i.code === 'UNKNOWN_FIELD')
    expect(issue?.location.field).toBe('trackingPixel')
  })
})
