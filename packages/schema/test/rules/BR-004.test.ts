import { describe, expect, it } from 'vitest'
import { validate } from '../../src/validate/index.js'
import { loadFixture, reference } from '../helpers.js'

/**
 * BR-004 — effect duration > 0.
 * Constitution II requires one test named for each business rule ID.
 */
describe('BR-004 (effect duration > 0)', () => {
  it('accepts the reference manifest, which satisfies the rule', () => {
    expect(validate(reference()).ok).toBe(true)
  })

  it('rejects a manifest violating BR-004 with EFFECT_DURATION_NOT_POSITIVE', () => {
    const result = validate(loadFixture('invalid/effect-duration-not-positive.json'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    const codes = result.issues.map((i) => i.code)
    expect(codes).toContain('EFFECT_DURATION_NOT_POSITIVE')
  })

  it('tags the issue with the rule id so compliance is greppable', () => {
    const result = validate(loadFixture('invalid/effect-duration-not-positive.json'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    const issue = result.issues.find((i) => i.code === 'EFFECT_DURATION_NOT_POSITIVE')
    expect(issue?.rule).toBe('BR-004')
  })
})
