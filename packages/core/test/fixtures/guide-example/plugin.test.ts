import { describe, expect, it } from 'vitest'
import { createElementRegistry } from '../../../src/elements/registry.js'
import { builtinElements } from '../../../src/elements/builtin/index.js'
import { countdownPlugin } from './plugin.js'
import type { ElementPlugin } from '../../../src/elements/contract.js'

/**
 * The guide's example, exercised — which is what stops the guide teaching something that does not work.
 */
describe('the guide example plugin', () => {
  it('registers alongside the builtins', () => {
    const registry = createElementRegistry([...builtinElements, countdownPlugin])
    expect(registry.has('countdown')).toBe(true)
    expect(registry.get('countdown')).toBe(countdownPlugin)
  })

  it('must be composed with the builtins, not passed alone', () => {
    /**
     * The cliff a third-party author meets first: a supplied registry **replaces** the default
     * rather than extending it. Passing only your own plugin leaves every MVP type unknown, and the
     * guide has to say so — `createElementRegistry([...builtinElements, mine])`.
     */
    const alone = createElementRegistry([countdownPlugin])
    expect(alone.has('countdown')).toBe(true)
    expect(alone.has('text')).toBe(false)
  })

  const MEMBERS = ['type', 'schema', 'resolve', 'inspector', 'validate', 'renderStateVersion'] as const

  for (const member of MEMBERS) {
    it(`is refused when \`${member}\` is missing, and the refusal names it`, () => {
      /**
       * Constitution I rejects partial plugins, so an author meets this refusal before they finish.
       * The guide has to explain it — and this asserts the explanation is true for every member,
       * rather than for the one somebody happened to test.
       */
      const partial = { ...countdownPlugin } as Record<string, unknown>
      delete partial[member]

      expect(() => createElementRegistry([partial as unknown as ElementPlugin])).toThrow(
        new RegExp(member),
      )
    })
  }

  it('reports only what the format cannot', () => {
    expect(countdownPlugin.validate({ seconds: 30 })).toEqual([])
    expect(countdownPlugin.validate({ seconds: 0 })[0]!.code).toBe('COUNTDOWN_HAS_NO_TIME')
    // A message a teacher can act on, not a code.
    expect(countdownPlugin.validate({ seconds: 0 })[0]!.message.length).toBeGreaterThan(40)
  })
})
