import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { server } from '../harness/render.js'
import { LessonPlayer } from '../../src/server.js'

/**
 * FR-028: the preference is honoured on the **first** rendered frame, before any script.
 *
 * This is the requirement that decides the whole design. That frame is produced on a server
 * which cannot read `prefers-reduced-motion`, so the choice cannot be made in JavaScript on
 * either side — not on the server, which has no answer, and not on the client, which arrives
 * too late. CSS chooses at paint time, and CSS can only choose between things already in the
 * markup.
 *
 * So what is asserted here is that **both answers are in the server's output**, and that
 * nothing on the server path so much as looks at the preference.
 */

const SRC = join(dirname(dirname(fileURLToPath(import.meta.url))), '..', 'src')

const moving = () =>
  lessonOf([
    slide([
      element({
        id: 'sliding',
        startMs: 0,
        endMs: 8000,
        effects: [{ id: 'fx', type: 'slide', phase: 'enter', startMs: 0, durationMs: 1000, order: 1 }],
      }),
    ]),
  ])

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(full) ? [full] : []
  })
}

describe('the server-rendered first frame', () => {
  it('carries the normal visual', () => {
    const markup = server(h(LessonPlayer, { lesson: moving() }))
    expect(markup).toMatch(/--cs-ty:\s*-?\d/)
  })

  it('carries the reduced alternative alongside it', () => {
    // Both, in the same markup, from a server that cannot know which will be used.
    const markup = server(h(LessonPlayer, { lesson: moving() }))
    expect(markup).toMatch(/--cs-r-opacity:/)
  })

  it('omits the reduced set for an element that is not moving', () => {
    // Most elements, most of the time. Emitting a second identical copy would double the
    // markup for no gain.
    const still = lessonOf([slide([element({ id: 'still', effects: [] })])])
    expect(server(h(LessonPlayer, { lesson: still }))).not.toContain('--cs-r-')
  })
})

describe('nothing on the server path reads the preference', () => {
  const files = sourceFiles(SRC)

  it('found the sources to scan', () => {
    expect(files.length).toBeGreaterThan(15)
  })

  it('never calls matchMedia anywhere in the package', () => {
    // Not merely "not on the server path". Reading the preference on the *client* would be
    // just as wrong: it would defer the decision to hydration, and a learner who asked for
    // less motion would see the full motion first.
    const offenders = files.filter((file) => /matchMedia/.test(readFileSync(file, 'utf8')))
    expect(offenders.map((f) => f.replace(`${SRC}/`, ''))).toEqual([])
  })

  it('never branches on prefers-reduced-motion in TypeScript', () => {
    const offenders = files.filter((file) => /prefers-reduced-motion/.test(readFileSync(file, 'utf8')))
    expect(offenders.map((f) => f.replace(`${SRC}/`, ''))).toEqual([])
  })
})
