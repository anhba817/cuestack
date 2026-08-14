import { describe, expect, it } from 'vitest'
import { validate } from '../src/validate/index.js'
import { reference } from './helpers.js'

/**
 * The contract from contracts/schema-package-api.md: validate() never throws.
 * An invalid lesson is an expected outcome, not an exceptional one.
 */
describe('validate() contract', () => {
  const hostile: Array<[string, unknown]> = [
    ['undefined', undefined],
    ['null', null],
    ['number', 42],
    ['string', 'not a lesson'],
    ['boolean', true],
    ['array', [1, 2, 3]],
    ['empty object', {}],
    ['function', () => 'nope'],
    ['symbol-keyed object', { [Symbol('x')]: 1 }],
  ]

  it.each(hostile)('does not throw for %s', (_label, input) => {
    expect(() => validate(input)).not.toThrow()
  })

  it.each(hostile)('returns a result object for %s', (_label, input) => {
    const r = validate(input)
    expect(r).toHaveProperty('ok')
    if (!r.ok) expect(Array.isArray(r.issues)).toBe(true)
  })

  it('does not throw on a cyclic object', () => {
    const cyclic: Record<string, unknown> = { schemaVersion: '1.0' }
    cyclic.self = cyclic
    expect(() => validate(cyclic)).not.toThrow()
    expect(validate(cyclic).ok).toBe(false)
  })

  it('always produces at least one issue when rejecting', () => {
    for (const [, input] of hostile) {
      const r = validate(input)
      if (!r.ok) expect(r.issues.length).toBeGreaterThan(0)
    }
  })

  it('does not mutate or retain its input', () => {
    const input = reference()
    const before = JSON.stringify(input)
    const r = validate(input)
    expect(JSON.stringify(input)).toBe(before)
    if (r.ok) expect(r.lesson).not.toBe(input)
  })
})
