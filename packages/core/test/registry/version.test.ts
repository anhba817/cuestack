import { describe, expect, it } from 'vitest'
import { RENDER_STATE_VERSION } from '../../src/elements/contract.js'
import { createElementRegistry } from '../../src/elements/registry.js'
import { syntheticPlugin } from '../harness/plugins.js'

/**
 * A plugin built against an incompatible RenderState shape is refused at
 * registration, rather than composing a stale contribution into a state that no
 * longer means the same thing — which would misbehave subtly instead of loudly.
 */
describe('plugin version compatibility', () => {
  it('accepts a plugin targeting the current version', () => {
    expect(() => createElementRegistry([syntheticPlugin()])).not.toThrow()
  })

  it('refuses a plugin built against an older version', () => {
    expect(() =>
      createElementRegistry([syntheticPlugin({ renderStateVersion: RENDER_STATE_VERSION - 1 })]),
    ).toThrow(/version/i)
  })

  it('refuses a plugin built against a newer version', () => {
    expect(() =>
      createElementRegistry([syntheticPlugin({ renderStateVersion: RENDER_STATE_VERSION + 1 })]),
    ).toThrow(/version/i)
  })

  it('names both versions so the mismatch is actionable', () => {
    let message = ''
    try {
      createElementRegistry([syntheticPlugin({ renderStateVersion: 99 })])
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain('99')
    expect(message).toContain(String(RENDER_STATE_VERSION))
  })
})
