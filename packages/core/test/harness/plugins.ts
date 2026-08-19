import type { Effect, Element } from '@cuestack/schema'
import { RENDER_STATE_VERSION, type ElementPlugin } from '../../src/elements/contract.js'

/** A synthetic element type, complete enough to register and be used. */
export function syntheticPlugin(overrides: Partial<ElementPlugin> = {}): ElementPlugin {
  return {
    type: 'gauge',
    schema: (payload): payload is unknown => typeof payload === 'object' && payload !== null,
    resolve: () => ({ visible: true, contribution: { opacity: 0.6 } }),
    inspector: { fields: [{ key: 'value', label: 'Value', kind: 'number' }] },
    validate: () => [],
    renderStateVersion: RENDER_STATE_VERSION,
    ...overrides,
  } as ElementPlugin
}

/**
 * Build an element or effect carrying a type the schema does not know.
 *
 * Worth an explicit helper rather than an inline cast at every call site, because
 * the reason matters. The lesson format's `type` is a closed union per schema
 * version, so a *registered but unversioned* type cannot appear in a schema-valid
 * manifest — by design. Adding an element or effect type is an additive MINOR
 * schema change with a migration (contracts/lesson-manifest.md §Versioning).
 *
 * That qualifies SC-007 without weakening it. The property under test is that the
 * *kernel* needs no change to handle a new type; shipping one to authors
 * additionally needs a schema minor. These tests exercise the kernel half, so they
 * construct past the union deliberately.
 */
export function syntheticElement(props: Record<string, unknown>): Element {
  return {
    id: 'synthetic',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    zIndex: 1,
    startMs: 0,
    endMs: 8000,
    effects: [],
    ...props,
  } as unknown as Element
}

export function syntheticEffect(props: Record<string, unknown>): Effect {
  return {
    id: 'synthetic_fx',
    phase: 'emphasis',
    startMs: 0,
    durationMs: 1000,
    order: 1,
    ...props,
  } as unknown as Effect
}

/**
 * A plugin whose `validate` reports something, and one whose `validate` throws.
 *
 * The two doubles feature 009's engine is measured against. The first proves the engine has no
 * branch on element type — it reports issues for a type it has never heard of. The second
 * proves an author with one broken plugin still gets every other issue, which is the
 * difference between a report that degrades and one that disappears.
 */
export function reportingPlugin(code = 'GAUGE_NEEDS_A_MAXIMUM'): ElementPlugin {
  return syntheticPlugin({
    validate: () => [{ code, message: 'A gauge needs a maximum, or it has nothing to fill.' }],
  })
}

export function throwingPlugin(): ElementPlugin {
  return syntheticPlugin({
    type: 'broken',
    validate: () => {
      throw new Error('this plugin is broken')
    },
  })
}
