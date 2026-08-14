import { describe, expect, it } from 'vitest'
import { validate } from '../src/validate/index.js'
import { codeFromFixtureName, invalidFixtureNames, loadFixture, reference } from './helpers.js'

/**
 * SC-002: 100% of the malformed corpus is rejected.
 *
 * Rejection alone is not enough — each fixture is named for the issue code it
 * must produce, so a fixture rejected for the WRONG reason fails too. Without
 * that, a single over-broad rule could "pass" the whole corpus.
 */
describe('malformed corpus', () => {
  const names = invalidFixtureNames()

  it('has fixtures to test', () => {
    expect(names.length).toBeGreaterThan(0)
  })

  it('accepts the reference manifest (control)', () => {
    expect(validate(reference()).ok).toBe(true)
  })

  it.each(names)('rejects %s', (name) => {
    expect(validate(loadFixture(`invalid/${name}.json`)).ok).toBe(false)
  })

  it.each(names)('rejects %s for the right reason', (name) => {
    const result = validate(loadFixture(`invalid/${name}.json`))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((i) => i.code)).toContain(codeFromFixtureName(name))
  })
})
