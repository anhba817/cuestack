import { describe, expect, it } from 'vitest'
import { validate } from '../src/validate/index.js'
import { withReference } from './helpers.js'

/**
 * Spec Edge Cases: an unrecognized element type is reported "as an unknown type
 * naming the type, not as a generic parse failure". A generic enum error is
 * exactly the failure mode that edge case forbids, so the distinct code is the
 * point of this test — not merely that validation fails.
 */
describe('unrecognized types', () => {
  it('reports an unknown element type with its own code', () => {
    const result = validate(withReference((m) => { m.slides[0].elements[0].type = 'carousel' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    const codes = result.issues.map((i) => i.code)
    expect(codes).toContain('UNKNOWN_ELEMENT_TYPE')
    expect(codes).not.toContain('ENUM_VALUE_INVALID')
  })

  it('names the offending element type in the message', () => {
    const result = validate(withReference((m) => { m.slides[0].elements[0].type = 'carousel' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    const issue = result.issues.find((i) => i.code === 'UNKNOWN_ELEMENT_TYPE')
    expect(issue?.message).toContain('carousel')
    expect(issue?.location.elementId).toBe('element_title')
  })

  it('reports an unknown effect type with its own code and names it', () => {
    const result = validate(withReference((m) => { m.slides[0].elements[0].effects[0].type = 'explode' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    const issue = result.issues.find((i) => i.code === 'UNKNOWN_EFFECT_TYPE')
    expect(issue).toBeDefined()
    expect(issue?.message).toContain('explode')
  })

  it('still uses ENUM_VALUE_INVALID for ordinary enum fields', () => {
    const result = validate(withReference((m) => { m.lesson.aspectRatio = '21:9' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((i) => i.code)).toContain('ENUM_VALUE_INVALID')
  })
})
