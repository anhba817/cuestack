import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { rules, stylesheet } from '../harness/css.js'

/**
 * US5 #4 · FR-026.
 *
 * The player applies no styles outside its own stage.
 *
 * This is the failure a host discovers in production and cannot easily attribute: a bare
 * `p` or `button` selector in a published stylesheet restyles their page, and the cause is
 * a dependency they installed for something else entirely. So it is checked structurally
 * rather than by review.
 *
 * Both files, and the *published* bundle as well as the sources — the concatenation step
 * is a place a rule could arrive from.
 */

const DIST = join(dirname(dirname(fileURLToPath(import.meta.url))), '..', 'dist', 'styles.css')

const SHEETS = ['reset.css', 'stage.css'] as const

describe('every rule is scoped beneath the stage', () => {
  for (const sheet of SHEETS) {
    describe(sheet, () => {
      const parsed = () => rules(stylesheet(sheet))

      it('has rules to check', () => {
        expect(parsed().length).toBeGreaterThan(0)
      })

      it('names no bare element or universal selector', () => {
        const offenders = parsed()
          .flatMap((r) => r.selectors)
          // Every selector must be anchored on a `cs-` class somewhere in it.
          .filter((s) => !/\.cs-/.test(s))
        expect(offenders).toEqual([])
      })

      it('never uses :root, html, or body', () => {
        const offenders = parsed()
          .flatMap((r) => r.selectors)
          .filter((s) => /(^|\s|,)(:root|html|body)\b/.test(s))
        expect(offenders).toEqual([])
      })

      it('declares no custom property outside the stage', () => {
        // A `--cs-*` definition on `:root` collides with a host's own tokens and outlives
        // the player's boundary. Definitions belong on the stage element, set by React.
        const offenders = parsed()
          .filter((r) => !r.selectors.some((s) => /\.cs-/.test(s)))
          .filter((r) => Object.keys(r.declarations).some((d) => d.startsWith('--')))
          .map((r) => r.selectors.join(', '))
        expect(offenders).toEqual([])
      })
    })
  }
})

describe('the published stylesheet', () => {
  const published = () => readFileSync(DIST, 'utf8')

  it('exists, so `@cuestack/react/styles.css` resolves to something', () => {
    expect(published().length).toBeGreaterThan(500)
  })

  it('contains no @import', () => {
    // The bug this replaced: `dist/styles.css` was a copy of a two-line file whose imports
    // pointed at files never placed in dist. It resolved, it was silent, and it applied
    // nothing — a host would have got an unpositioned stage and no error.
    expect(published()).not.toContain('@import')
  })

  it('carries the scaling mechanism and the reset, in that order', () => {
    const css = published()
    expect(css).toContain('container-type: size')
    expect(css).toContain('100cqw')
    expect(css.indexOf('cs-stage')).toBeGreaterThan(-1)
  })

  it('is scoped, like its sources', () => {
    const offenders = rules(published())
      .flatMap((r) => r.selectors)
      .filter((s) => !/\.cs-/.test(s))
    expect(offenders).toEqual([])
  })
})
