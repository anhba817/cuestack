import { describe, expect, it } from 'vitest'
import { builtinElements } from '@cuestack/core'
import {
  builtinElementEditors,
  createElementEditorRegistry,
} from '../../../src/registry/editors.js'
import { countdownEditor } from './editor.js'

/**
 * SC-013 for the guide's **third** piece: exercised, not merely compiled.
 *
 * Companion to `packages/react/test/fixtures/guide-example/renderer.test.tsx`, and added for the
 * same reason — the core plugin had four suites and these two had none, so "a change to any contract
 * it depends on fails the build" held through `pnpm typecheck` while "exercised by the suite" did
 * not.
 *
 * This piece has the quietest failure of the four: without it the type is simply absent from the Add
 * menu, which a teacher discovers rather than a test. That is exactly the kind of thing worth a test.
 */
describe("the guide's editor registration works, not just type-checks", () => {
  it('is accepted by the registry, defaults and all', () => {
    // `assertComplete` refuses a registration with no `defaults` or no `inspector`, naming what is
    // missing — a type with no defaults cannot be added to a slide at all.
    const registry = createElementEditorRegistry([...builtinElementEditors, countdownEditor])
    expect(registry.has('countdown')).toBe(true)
    expect(registry.get('countdown')?.defaults.width).toBe(200)
  })

  it('appears in the type list the Add menu reads', () => {
    // The failure this piece exists to prevent, asserted where it actually shows up.
    const registry = createElementEditorRegistry([...builtinElementEditors, countdownEditor])
    expect(registry.types()).toContain('countdown')
  })

  it('does not displace the built-in editors it is registered alongside', () => {
    const registry = createElementEditorRegistry([...builtinElementEditors, countdownEditor])
    for (const type of ['text', 'shape', 'image']) {
      expect(registry.has(type), type).toBe(true)
    }
  })

  it('starts a new element as something the format would accept', () => {
    /**
     * `defaults.payload` is what a teacher gets the instant they add one, and it has to satisfy the
     * type's own guard — the plugin's `schema` in `@cuestack/core`. A default that did not would put
     * a teacher in front of a validation error they did not cause and cannot fix.
     */
    const plugin = builtinElements.find((p) => p.type === 'countdown')
    // The guide's plugin is a core *test* fixture, so it is not in `builtinElements` — which is the
    // point of the guide. Asserted rather than assumed, so this reads as intent and not oversight.
    expect(plugin, 'a third-party type is not a built-in').toBeUndefined()

    const payload = countdownEditor.defaults.payload as { seconds?: unknown; announceFinal?: unknown }
    expect(typeof payload.seconds).toBe('number')
    expect(typeof payload.announceFinal).toBe('boolean')
  })

  it('declares no fields of its own, because the plugin owns that list', () => {
    /**
     * The guide's own argument, held to. Fields come from the plugin's `inspector` in
     * `@cuestack/core`; this package overlays only what describes *editing* rather than the field.
     * A registration that restated the field list would give the type two lists to keep in
     * agreement, which is the duplication `fieldsFor` exists to prevent.
     */
    expect(countdownEditor.inspector).toEqual([])
  })
})
