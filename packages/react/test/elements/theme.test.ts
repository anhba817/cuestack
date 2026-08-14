import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { allTypesSlide, lessonOf } from '../harness/corpus.js'
import { server } from '../harness/render.js'
import { LessonPlayer } from '../../src/server.js'
import { rules, stylesheet } from '../harness/css.js'

/**
 * US4 #2, #6 · FR-014 · FR-019 · SC-008.
 *
 * Every renderer's appearance comes from theme properties, and a missing token falls
 * back readably rather than invisibly.
 *
 * The second half is the one that gets skipped. `var(--cs-theme-accent-primary)` with no
 * fallback does not error when the token is absent — the whole declaration is dropped,
 * so the element renders transparent, or at the origin, and it looks like a bug
 * somewhere else entirely.
 */

const ELEMENT_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), '..', 'src', 'elements')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(full) ? [full] : []
  })
}

const strip = (body: string): string =>
  body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

describe('appearance comes from the theme', () => {
  const files = sourceFiles(ELEMENT_DIR)

  it('found the renderers to scan', () => {
    expect(files.length).toBeGreaterThan(6)
  })

  it('has no colour literal in any renderer', () => {
    // The lint rule enforces this too. Asserted here as well because a lint rule can be
    // disabled inline with a comment, and a test cannot.
    const offenders = files.filter((file) =>
      /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(strip(readFileSync(file, 'utf8'))),
    )
    expect(offenders.map((f) => f.replace(ELEMENT_DIR, 'elements'))).toEqual([])
  })

  it('has no font or spacing literal in any renderer', () => {
    const offenders = files.filter((file) =>
      /\b\d+(?:\.\d+)?(?:px|rem|em|pt)\b/.test(strip(readFileSync(file, 'utf8'))),
    )
    expect(offenders.map((f) => f.replace(ELEMENT_DIR, 'elements'))).toEqual([])
  })

  it('gives every theme property it reads a fallback', () => {
    // Both halves of the codebase: the stylesheet and the renderers.
    const sources = [stylesheet(), ...files.map((f) => readFileSync(f, 'utf8'))]
    const bare: string[] = []
    for (const source of sources) {
      for (const match of source.matchAll(/var\(\s*(--cs-theme-[\w-]+)\s*([,)])/g)) {
        if (match[2] === ')') bare.push(match[1]!)
      }
    }
    expect(bare).toEqual([])
  })

  it('renders visibly with a theme that supplies nothing at all', () => {
    // FR-019 as an outcome rather than a mechanism: no theme, still a lesson.
    const markup = server(h(LessonPlayer, { lesson: lessonOf([allTypesSlide()]) }))
    expect(markup).toContain('cs-stage')
    expect(markup).toContain('Some words')
    expect(markup).not.toContain('cs-placeholder')
  })

  it('lets a host override the lesson\'s own theme', () => {
    const markup = server(
      h(LessonPlayer, {
        lesson: lessonOf([allTypesSlide()]),
        theme: { 'accent.primary': 'rebeccapurple' },
      }),
    )
    expect(markup).toContain('--cs-theme-accent-primary:rebeccapurple')
  })

  it('scopes every rule beneath the stage', () => {
    // FR-026. A bare `p` or `*` selector in a published stylesheet restyles the host's
    // page, and the host finds out in production.
    const offenders = rules()
      .flatMap((r) => r.selectors)
      .filter((s) => !/(^|\s|,)\.cs-/.test(s) && s !== ':root')
    expect(offenders).toEqual([])
  })

  it('defines no custom property on :root', () => {
    // Properties on `:root` leak out of the player's boundary and collide with a host's
    // own tokens. Everything lives on the stage element instead.
    expect(rules().flatMap((r) => r.selectors)).not.toContain(':root')
  })
})
