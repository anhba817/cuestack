import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from './harness/mount.js'
import { covered } from './harness/lessons.js'
import { STYLESHEET } from '../src/styles.js'

const REACT_SRC = join(import.meta.dirname, '..', '..', 'react', 'src')

let mounted: { unmount(): void } | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

/**
 * Why shadow DOM is affordable: custom properties inherit across the boundary, so the theming
 * contract the React player uses keeps working when the player is isolated.
 *
 * **What this environment cannot check.** happy-dom's `getComputedStyle` does not cascade custom
 * properties to descendants — probed directly, a `--x` set on a parent reads back `""` on its child
 * in plain light DOM, never mind through a shadow root. So an assertion that a themed value reaches
 * a rendered node would be asserting a feature the DOM implementation does not have; it could only
 * ever fail, or pass for a reason unrelated to the boundary. The inheritance claim is a CSS-spec
 * guarantee and belongs to the manual pass (T043) in a real browser.
 *
 * What is checkable here is the half that is ours rather than the platform's: that the adapter reads
 * its colours from the same token names the React player writes. If inheritance works and the names
 * match, theming works; the names are the part we can get wrong. That none of them is hard-coded is
 * `tokens.test.ts`'s subject, so it is asserted there rather than in both places.
 */
describe('theming', () => {
  it('consumes the token names the React player already uses', () => {
    /**
     * The token vocabulary is a convention, not a declared list — `themeProperty` turns any key of a
     * lesson's theme into `--cs-theme-<key>`, so nothing rejects a misspelling. A host therefore
     * themes both players by setting the *same* names, and an adapter that reads different ones is
     * unthemed in a way that looks deliberate: every `var()` quietly takes its fallback and the
     * lesson renders plainly rather than wrongly.
     *
     * That is what this caught. The first draft of the stylesheet read `--cs-theme-text`,
     * `--cs-theme-stage`, `--cs-theme-font` and `--cs-theme-font-small`; the player writes
     * `--cs-theme-text-default`, `--cs-theme-surface-default`, `--cs-theme-font-body` and
     * `--cs-theme-font-size-caption`. Four tokens, no error, no visible failure in any other test.
     *
     * So the expected set is read out of the player's sources rather than restated here: a rename
     * there fails this test instead of un-theming the web component.
     */
    const used = new Set(
      readdirSync(REACT_SRC, { recursive: true })
        .map(String)
        .filter((f) => /\.(tsx?|css)$/.test(f))
        .flatMap((f) => readFileSync(join(REACT_SRC, f), 'utf8').match(/--cs-theme-[a-z-]+/g) ?? []),
    )
    expect(used.size).toBeGreaterThan(5)

    for (const consumed of new Set(STYLESHEET.match(/--cs-theme-[a-z-]+/g) ?? [])) {
      expect([...used], `${consumed} is a name no player writes`).toContain(consumed)
    }
  })

  it('positions with the same property names the player does', () => {
    for (const name of ['--cs-x', '--cs-y', '--cs-w', '--cs-h', '--cs-opacity']) {
      expect(STYLESHEET).toContain(name)
    }
  })

  it('sets no colour inline, where a host theme could not reach it', async () => {
    const m = (mounted = await mount(covered()))
    for (const node of m.root.querySelectorAll<HTMLElement>('[data-cs-element-id]')) {
      expect(node.getAttribute('style') ?? '').not.toMatch(/color|background/)
    }
  })
})
