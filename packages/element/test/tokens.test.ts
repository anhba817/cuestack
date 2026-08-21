import { describe, expect, it } from 'vitest'
import { STYLESHEET } from '../src/styles.js'

/**
 * Constitution III, asserted against the CSS the shadow root actually receives.
 *
 * **Why this is a test and not only a lint rule**, measured rather than assumed. `no-restricted-syntax`
 * matches source *nodes*. A bare `'#8a8a8a'` is caught, and so is one written inside a template
 * literal — that second selector was added this feature, because `Literal[value=/^#/]` does not match
 * a hex in a template (the node is a `TemplateElement`). What still escapes it is a colour the AST
 * never sees as a colour: `['#', '8a', '8a', '8a'].join('')` interpolated into the stylesheet passes
 * `pnpm lint` cleanly and fails the first test below. Both were tried; those are the results.
 *
 * That is the division of labour. The rule guards the whole of `packages/element/src` cheaply and
 * catches the mistake anybody actually makes. This reads the finished string — the thing a browser
 * paints — so no amount of cleverness in how it was assembled changes what it says.
 */

/** Everything in the stylesheet that could be a colour, however it got there. */
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\bcolor-mix\(/g

/** A declaration's property and value, for the properties that carry design decisions. */
const declarations = (property: RegExp): string[] =>
  [...STYLESHEET.matchAll(new RegExp(`(${property.source})\\s*:\\s*([^;}]+)`, 'g'))].map((m) =>
    m[2]!.trim(),
  )

describe('every design value in the emitted stylesheet resolves from a token', () => {
  it('contains no colour literal at all', () => {
    expect(STYLESHEET.match(COLOUR) ?? []).toEqual([])
  })

  it('resolves every colour-bearing property through var()', () => {
    for (const value of declarations(/color|background|border-color|fill|stroke/)) {
      // `currentColor`, `inherit`, `transparent` and `none` are keywords, not decisions — they defer
      // to something else rather than naming a colour, which is the point of the rule.
      if (/^(currentColor|inherit|transparent|none|unset)$/i.test(value)) continue
      expect(value, `"${value}" names a colour instead of reading one`).toMatch(/var\(--cs-/)
    }
  })

  it('resolves every typographic value through var()', () => {
    for (const value of declarations(/font-family|font-size|font-weight|line-height/)) {
      if (/^(inherit|unset)$/i.test(value)) continue
      expect(value, `"${value}" hard-codes type instead of reading it`).toMatch(/var\(--cs-/)
    }
  })

  it('every token it reads has a readable fallback', () => {
    /**
     * FR-019. A lesson whose theme omits a token must render plainly, not invisibly — and a
     * `var(--cs-theme-x)` with no second argument resolves to nothing, which for `color` means the
     * text inherits and for `background` means it disappears. Cheap to get wrong, invisible until a
     * host ships a partial theme.
     */
    const bare = [...STYLESHEET.matchAll(/var\(\s*(--cs-theme-[a-z-]+)\s*\)/g)].map((m) => m[1]!)
    expect(bare, 'these theme tokens are read with no fallback').toEqual([])
  })

  it('states what it does not assert about spacing, and why', () => {
    /**
     * T025a asked for spacing too. It is deliberately not asserted, and the measurement is the
     * reason rather than the excuse: **the framework has no spacing token.** Every
     * `--cs-theme-*` name any package reads is a colour, a type value, or `--cs-theme-radius`;
     * `@cuestack/react`'s own stylesheets write `gap: 8px` and `padding: 12px` as literals, and
     * `gate:theme-values` cannot see them because it delegates to ESLint, which does not parse CSS.
     *
     * So requiring this stylesheet to read spacing from a token would invent a name no lesson theme
     * can supply, no other package reads, and nothing defines — holding the demonstration adapter to
     * a stricter standard than the shipped player, in a way a host could not actually use. The gap
     * belongs to the framework's token vocabulary and is recorded in the framework plan.
     *
     * This test asserts the boundary rather than the absence: if a spacing token ever appears, this
     * fails and the paragraph above stops being true, which is the only way a note like it survives.
     */
    const named = STYLESHEET.match(/--cs-theme-(space|spacing|gap|padding|margin)[a-z-]*/g) ?? []
    expect(named, 'a spacing token now exists — assert it rather than excusing it').toEqual([])
  })
})
