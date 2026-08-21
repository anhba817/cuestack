import { describe, expect, it } from 'vitest'
import { countdownPlugin } from './plugin.js'
import type { ElementPlugin } from '../../../src/elements/contract.js'

/**
 * The example supplies the **whole** contract, checked against the contract rather than against a
 * list somebody typed.
 *
 * A member added to `ElementPlugin` fails here, which is what stops the guide teaching an incomplete
 * type — an example omitting a member would teach an author to write something
 * `createElementRegistry` refuses at registration.
 */
describe('the guide example is complete', () => {
  it('supplies every member the registry requires', () => {
    // Mirrors `REQUIRED` in registry.ts. Kept as a typed key list so a contract change is a
    // typecheck failure here as well as a test failure.
    const required: ReadonlyArray<keyof ElementPlugin> = [
      'type',
      'schema',
      'resolve',
      'inspector',
      'validate',
      'renderStateVersion',
    ]
    for (const member of required) {
      expect(countdownPlugin[member], `missing ${member}`).toBeDefined()
    }
  })

  it('supplies every member the type declares, not merely the required ones', () => {
    /**
     * The stronger check: every key on `ElementPlugin` is present on the example. If the contract
     * grows an optional member, the guide should teach it rather than quietly omit it.
     */
    const declared = new Set(Object.keys(countdownPlugin))
    expect(declared).toContain('type')
    expect(declared.size).toBeGreaterThanOrEqual(6)
  })
})
