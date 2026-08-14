import { describe, expect, it } from 'vitest'
import { validate } from '../../src/validate/index.js'
import { loadFixture, reference } from '../helpers.js'

/**
 * BR-002 — start time >= 0.
 * Constitution II requires one test named for each business rule ID.
 */
describe('BR-002 (start time >= 0)', () => {
  it('accepts the reference manifest, which satisfies the rule', () => {
    expect(validate(reference()).ok).toBe(true)
  })

  it('rejects a manifest violating BR-002 with TIMING_NEGATIVE', () => {
    const result = validate(loadFixture('invalid/timing-negative.json'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    const codes = result.issues.map((i) => i.code)
    expect(codes).toContain('TIMING_NEGATIVE')
  })

  it('tags the issue with the rule id so compliance is greppable', () => {
    const result = validate(loadFixture('invalid/timing-negative.json'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    const issue = result.issues.find((i) => i.code === 'TIMING_NEGATIVE')
    expect(issue?.rule).toBe('BR-002')
  })
})
