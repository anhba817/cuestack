import { afterEach, describe, expect, it } from 'vitest'
import { STYLESHEET } from '../src/styles.js'
import { mount, type Mounted } from './harness/mount.js'
import { covered, twoSlides } from './harness/lessons.js'

let mounted: Mounted | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

/**
 * The stage's half of canvas-relative layout.
 *
 * **Found by sweeping breakages past the suite rather than by reading it.** Six deliberate faults
 * passed ninety-eight tests: removing `container-type`, removing `aspect-ratio`, never writing
 * `--cs-canvas-w/h`, dropping `overflow: hidden`, dropping `data-cs-element-type`, and dropping the
 * leaving half's transition duration. Every one is load-bearing in a browser and invisible here.
 *
 * The reason they all survived is one gap. `agreement.test.ts` evaluates the `.cs-element`
 * declarations against a container box **it supplies itself** — which is the only way to compare
 * two stylesheets in a DOM with no layout, and which quietly assumes the other half. Nothing asked
 * whether the stage actually establishes that container or carries the numbers the rules divide by.
 *
 * So this file asserts the assumption. Where a value is shared with the player, it is compared
 * against the player's own stylesheet rather than restated, so a change there fails here.
 */

const declarations = (css: string, selector: string): Record<string, string> => {
  // Escaped once, deliberately plainly. A first draft carried a leftover ternary that emitted a
  // stray backslash into the pattern, so every lookup failed with ".cs-stage not found" — which
  // reads like a missing rule and was a broken regex.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  if (!block) throw new Error(`${selector} not found`)
  return Object.fromEntries(
    block[1]!
      .split(';')
      .map((line) => line.replace(/\/\*[\s\S]*?\*\//g, '').trim())
      .filter(Boolean)
      .map((line) => {
        const at = line.indexOf(':')
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()]
      }),
  )
}

describe('the stage establishes the canvas everything is measured against', () => {
  const stage = (): Record<string, string> => declarations(STYLESHEET, '.cs-stage')

  it('is a query container, or no cqw resolves at all', () => {
    // `100cqw` needs a container. Without this the geometry rules divide correctly and multiply by
    // nothing, and every element collapses — in a browser, invisibly to happy-dom.
    expect(stage()['container-type']).toBe('size')
  })

  it('takes its shape from the canvas', () => {
    // The ratio is what makes one logical unit the same length on both axes. Absent, the stage takes
    // its height from content and the vertical half of every coordinate is measured against nothing.
    expect(stage()['aspect-ratio']).toBe('var(--cs-canvas-w) / var(--cs-canvas-h)')
  })

  it('clips to itself rather than to the host page', () => {
    // An off-canvas element would otherwise extend the host's document and scroll their page.
    expect(stage()['overflow']).toBe('hidden')
  })

  it('carries the canvas numbers the geometry rules divide by', async () => {
    const m = (mounted = await mount(covered()))
    const node = m.root.querySelector<HTMLElement>('.cs-stage')!
    // 16:9 in the fixture. Written once per lesson, not per frame — and if they are missing every
    // `calc()` in the stylesheet has an undefined divisor.
    expect(node.style.getPropertyValue('--cs-canvas-w').trim()).toBe('1600')
    expect(node.style.getPropertyValue('--cs-canvas-h').trim()).toBe('900')
  })

  it('uses the same stage rules as the React player', async () => {
    /**
     * Compared rather than restated. These four decide layout jointly with the `.cs-element` rules
     * `agreement.test.ts` already compares, and a divergence in either half breaks parity — which is
     * exactly what happened when this adapter positioned in raw pixels while the player scaled.
     */
    // `import.meta.dirname` + join, not `new URL(...)` — happy-dom shims URL differently from the
    // node environment, and the URL form throws "must be of scheme file". The React harness's own
    // header records the same trap, which is where this form comes from.
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const player = declarations(
      readFileSync(join(import.meta.dirname, '..', '..', 'react', 'src', 'styles', 'stage.css'), 'utf8'),
      '.cs-stage',
    )
    for (const property of ['container-type', 'aspect-ratio', 'overflow', 'width']) {
      expect(stage()[property], `.cs-stage { ${property} } must match the player`).toBe(player[property])
    }
  })

  it('marks each element with its type as well as its id', async () => {
    // `ElementFrame.tsx` writes both. A host styling `[data-cs-element-type="shape"]` against one
    // player and not the other is the silent-divergence case this whole adapter exists to surface.
    const m = (mounted = await mount(covered()))
    const node = m.root.querySelector<HTMLElement>('[data-cs-element-id="box"]')!
    expect(node.dataset['csElementType']).toBe('shape')
  })

  it('gives both halves of a transition the authored duration', async () => {
    // The leaving half animates too. Without the property its animation resolves to 0ms and the
    // outgoing slide vanishes rather than leaving.
    const m = (mounted = await mount(twoSlides()))
    await m.advance(4200)
    for (const role of ['leaving', 'entering']) {
      const half = m.root.querySelector<HTMLElement>(`[data-cs-transition="${role}"]`)!
      expect(half.style.getPropertyValue('--cs-transition-ms').trim(), role).toBe('600')
    }
  })
})
