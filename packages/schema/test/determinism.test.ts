import { describe, expect, it } from 'vitest'
import { validate } from '../src/validate/index.js'
import { invalidFixtureNames, loadFixture, reference } from './helpers.js'

/**
 * SC-008: two consecutive validations of the same input are byte-identical.
 *
 * Invalid inputs matter more than valid ones here — an error message is where a
 * timestamp or a generated id most plausibly leaks in, and it would look
 * harmless in review.
 */
describe('determinism', () => {
  it('produces byte-identical output for the reference manifest', () => {
    const input = reference()
    expect(JSON.stringify(validate(input))).toBe(JSON.stringify(validate(input)))
  })

  it.each(invalidFixtureNames())('produces byte-identical output for %s', (name) => {
    const input = loadFixture(`invalid/${name}.json`)
    const a = JSON.stringify(validate(input))
    const b = JSON.stringify(validate(input))
    expect(a).toBe(b)
  })

  it('produces byte-identical output across hostile inputs', () => {
    for (const input of [undefined, null, 42, 'x', [], {}]) {
      expect(JSON.stringify(validate(input))).toBe(JSON.stringify(validate(input)))
    }
  })

  it('issue messages contain no digits that look like a timestamp', () => {
    for (const name of invalidFixtureNames()) {
      const r = validate(loadFixture(`invalid/${name}.json`))
      if (r.ok) continue
      for (const issue of r.issues) {
        expect(issue.message).not.toMatch(/1[6-9]\d{11}/) // epoch millis
        expect(issue.message).not.toMatch(/\d{4}-\d{2}-\d{2}T/) // ISO datetime
      }
    }
  })
})
