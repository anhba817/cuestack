import { describe, expect, it } from 'vitest'
import { validate } from '../../src/validate/index.js'
import { loadFixture, reference } from '../helpers.js'

/**
 * BR-003 — end after start.
 * Constitution II requires one test named for each business rule ID.
 */
describe('BR-003 (end after start)', () => {
  it('accepts the reference manifest, which satisfies the rule', () => {
    expect(validate(reference()).ok).toBe(true)
  })

  it('rejects a manifest violating BR-003 with TIMING_END_BEFORE_START', () => {
    const result = validate(loadFixture('invalid/timing-end-before-start.json'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    const codes = result.issues.map((i) => i.code)
    expect(codes).toContain('TIMING_END_BEFORE_START')
  })

  it('tags the issue with the rule id so compliance is greppable', () => {
    const result = validate(loadFixture('invalid/timing-end-before-start.json'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    const issue = result.issues.find((i) => i.code === 'TIMING_END_BEFORE_START')
    expect(issue?.rule).toBe('BR-003')
  })
})
