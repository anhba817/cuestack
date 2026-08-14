import { describe, expect, it } from 'vitest'
import { createElementRegistry } from '../../src/elements/registry.js'
import { syntheticPlugin } from '../harness/plugins.js'
import type { ElementPlugin } from '../../src/elements/contract.js'

/**
 * FR-026: a registration is refused unless the contract is complete, with the
 * missing member named.
 *
 * All members are required rather than optional-with-defaults because a plugin
 * missing `inspector` is invisible in the editor and one missing `validate` passes
 * publication checks it should fail — both discovered two waves later, by a teacher.
 */
const MEMBERS = ['type', 'schema', 'resolve', 'inspector', 'validate', 'renderStateVersion'] as const

describe('incomplete registrations', () => {
  it.each(MEMBERS)('refuses a plugin missing %s, naming it', (member) => {
    const partial = { ...syntheticPlugin() } as Record<string, unknown>
    delete partial[member]
    expect(() => createElementRegistry([partial as unknown as ElementPlugin])).toThrow(
      new RegExp(member),
    )
  })

  it('names the plugin in the refusal so the source is obvious', () => {
    const partial = { ...syntheticPlugin() } as Record<string, unknown>
    delete partial['resolve']
    expect(() => createElementRegistry([partial as unknown as ElementPlugin])).toThrow(/gauge/)
  })

  it('refuses a late registration on the same terms', () => {
    const registry = createElementRegistry()
    const partial = { ...syntheticPlugin() } as Record<string, unknown>
    delete partial['inspector']
    expect(() => registry.register(partial as unknown as ElementPlugin)).toThrow(/inspector/)
  })

  it('accepts a complete plugin', () => {
    expect(() => createElementRegistry([syntheticPlugin()])).not.toThrow()
  })

  it('reports the registered types in a stable order', () => {
    const registry = createElementRegistry([
      syntheticPlugin({ type: 'zebra' }),
      syntheticPlugin({ type: 'alpha' }),
    ])
    expect(registry.types()).toEqual(['alpha', 'zebra'])
  })
})
