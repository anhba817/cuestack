import { describe, expect, it } from 'vitest'
import { isDeadEnd } from '../../src/interactions/policy.js'

/**
 * The static half of the pair, asserted against the same three subtleties `isUnsatisfiable` knows.
 *
 * Written as a table because the value of putting this beside its runtime twin is that both are
 * read together — a change to `DEFAULT_COMPLETION_POLICY` that broke one would break this.
 */
describe('isDeadEnd', () => {
  it('is true only for on_correct with a finite cap', () => {
    expect(isDeadEnd('on_correct', 1)).toBe(true)
    expect(isDeadEnd('on_correct', 3)).toBe(true)
  })

  it('is false when the attempts are unlimited, because they always terminate', () => {
    expect(isDeadEnd('on_correct', undefined)).toBe(false)
  })

  it('is false for the policies that complete on anything', () => {
    expect(isDeadEnd('on_first_attempt', 1)).toBe(false)
    expect(isDeadEnd('on_attempts_exhausted', 1)).toBe(false)
  })

  it('is false when nothing was configured, because the default is the permissive one', () => {
    expect(isDeadEnd(undefined, 1)).toBe(false)
  })
})
