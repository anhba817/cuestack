import { describe, expect, it } from 'vitest'
import { validate } from '../../src/validate/index.js'
import { loadFixture, reference } from '../helpers.js'

/**
 * BR-001 — integer milliseconds.
 * Constitution II requires one test named for each business rule ID.
 */
describe('BR-001 (integer milliseconds)', () => {
  it('accepts the reference manifest, which satisfies the rule', () => {
    expect(validate(reference()).ok).toBe(true)
  })

  it('rejects a manifest violating BR-001 with TIMING_NOT_INTEGER', () => {
    const result = validate(loadFixture('invalid/timing-not-integer.json'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    const codes = result.issues.map((i) => i.code)
    expect(codes).toContain('TIMING_NOT_INTEGER')
  })

  it('tags the issue with the rule id so compliance is greppable', () => {
    const result = validate(loadFixture('invalid/timing-not-integer.json'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    const issue = result.issues.find((i) => i.code === 'TIMING_NOT_INTEGER')
    expect(issue?.rule).toBe('BR-001')
  })
})
