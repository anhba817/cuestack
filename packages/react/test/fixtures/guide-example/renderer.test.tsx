import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import type { ResolvedElement } from '@cuestack/core'
import { createRendererRegistry } from '../../../src/elements/registry.js'
import { builtinRenderers } from '../../../src/elements/builtin/index.js'
import { client } from '../../harness/render.js'
import { countdownRenderer } from './renderer.js'

/**
 * SC-013 for the guide's **second** piece: exercised, not merely compiled.
 *
 * **This did not exist, and the gap was worth having found.** The core plugin has four suites —
 * registration, completeness, inertness, saving — and the renderer and the editor registration had
 * none. `pnpm typecheck` catches a missing member, so "a change to any contract it depends on fails
 * the build" was true; "exercised by the suite" was not. A renderer that satisfies `ElementRenderer`
 * and throws the moment it draws would have passed everything.
 *
 * That matters more here than for most fixtures, because the guide's promise is *do this and it
 * works*. A shape check does not make that promise good.
 */
/**
 * A host resolver. Required by `ElementRendererProps` even for a type that has no assets — the
 * contract is uniform, and the guide's example ignores it.
 *
 * Omitted from the first draft of this file, which ran green under vitest and failed `pnpm
 * typecheck`. That is the same shape-versus-behaviour split these tests exist to close, arriving in
 * the tests themselves: passing is not compiling, and this repository needs both.
 */
const resolveAsset = (): string | undefined => undefined

const resolved = (payload: unknown): ResolvedElement =>
  ({
    id: 'e1',
    type: 'countdown',
    payload,
    geometry: { x: 0, y: 0, width: 200, height: 100, rotation: 0 },
    zIndex: 1,
    opacity: 1,
    transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotate: 0 },
    reduced: null,
    filter: null,
    available: true,
    accessibility: undefined,
  }) as unknown as ResolvedElement

describe("the guide's renderer works, not just type-checks", () => {
  it('is accepted by the registry a host actually builds', () => {
    // `createRendererRegistry` runs `assertComplete`, which is where a missing `label` is refused —
    // at registration, in the host's own words, rather than as a silent absence at render time.
    const registry = createRendererRegistry([...builtinRenderers, countdownRenderer])
    expect(registry.has('countdown')).toBe(true)
    expect(registry.get('countdown')?.label).toBe('Countdown')
  })

  it('does not displace the built-in types it is registered alongside', () => {
    // The spread the guide tells a developer to write. Getting it wrong loses all seven built-ins,
    // which is the documented surprise in `docs/packages.md` and worth one assertion here.
    const registry = createRendererRegistry([...builtinRenderers, countdownRenderer])
    for (const type of ['text', 'shape', 'image']) {
      expect(registry.has(type), type).toBe(true)
    }
  })

  it('draws its payload as text', async () => {
    const registry = createRendererRegistry([countdownRenderer])
    const renderer = registry.get('countdown')!
    const container = await client(
      h(renderer.Component, { element: resolved({ seconds: 30, announceFinal: true }), resolveAsset }),
    )
    expect(container.textContent).toBe('30s')
  })

  it('renders a payload it did not expect without throwing', async () => {
    /**
     * The guide's example reads `payload.seconds ?? 0`, and this is why. A renderer is handed
     * whatever the manifest holds — including a lesson authored before the type gained a field — and
     * one that threw would take the whole slide down rather than drawing something plain.
     */
    const registry = createRendererRegistry([countdownRenderer])
    const renderer = registry.get('countdown')!
    const container = await client(h(renderer.Component, { element: resolved({}), resolveAsset }))
    expect(container.textContent).toBe('0s')
  })

  it('renders author-supplied content as characters, never as markup', async () => {
    // The rule the whole repository is arranged around, asserted against the guide's own example so
    // a developer copying it copies the safe shape.
    const registry = createRendererRegistry([countdownRenderer])
    const renderer = registry.get('countdown')!
    const container = await client(
      h(renderer.Component, { element: resolved({ seconds: '<script>alert(1)</script>' }), resolveAsset }),
    )
    expect(container.querySelector('script')).toBeNull()
  })
})
