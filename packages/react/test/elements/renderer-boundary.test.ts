import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * SC-007 / FR-012 — a renderer receives its element, a way to address assets, and narrow
 * capabilities. Not the lesson, the slide, its siblings, the transport, or the time.
 *
 * **Written before the capability it guards, because three implementations of this feature break
 * the boundary and all three work.** Adding `transport` to these props is one line. Calling
 * `usePlayer()` inside `ButtonElement` needs no plumbing at all and hands the renderer the whole
 * transport. A DOM event bubbling to the stage keeps the types clean and makes the contract
 * implicit. None of them fails any other test — a button that navigates is a button that
 * navigates — and each makes third-party renderers break the next time the lesson shape changes.
 *
 * Written afterwards, this test gets written against whichever shortcut was already taken.
 */
const SRC = join(import.meta.dirname, '..', '..', 'src')

const code = (path: string): string =>
  readFileSync(join(SRC, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

describe('a renderer cannot reach the lesson', () => {
  it('is given nothing that leads to it', () => {
    const registry = code('elements/registry.tsx')
    const props = /export interface ElementRendererProps \{([\s\S]*?)\n\}/.exec(registry)
    expect(props, 'ElementRendererProps not found — the extractor is stale, not the code').toBeTruthy()

    for (const forbidden of ['transport', 'lesson', 'slide', 'slideTimeMs', 'slideIndex']) {
      expect(props![1], `renderers must not receive ${forbidden}`).not.toMatch(
        new RegExp(`\\b${forbidden}\\b`),
      )
    }
  })

  it('is not handed one through the player hook either', () => {
    /**
     * The shortcut that needs no plumbing: `usePlayer()` returns the transport directly, by
     * design, for hosts. A *renderer* calling it would reach everything this file exists to keep
     * away — and nothing else in the suite would notice.
     */
    for (const file of ['elements/builtin/ButtonElement.tsx']) {
      expect(code(file), `${file} must not reach for the transport`).not.toMatch(/usePlayer/)
    }
  })

  it('does not receive navigation as a bubbling DOM event either', () => {
    // The third shortcut: clean types, implicit contract, and a second mechanism the web
    // component would need to reinvent. Capabilities are passed, not broadcast.
    expect(code('elements/builtin/ButtonElement.tsx')).not.toMatch(/dispatchEvent|CustomEvent/)
  })
})
