import { describe, expect, it } from 'vitest'
import { server } from '../harness/render.js'
import { corpus, element, lessonOf, referenceLesson, slide } from '../harness/corpus.js'
import { LessonPlayer } from '../../src/server.js'
import { createElement as h } from 'react'

/**
 * SC-001 / FR-001, FR-003. The first slide's text must be in the markup a learner
 * receives — before any script runs, and readable by a search engine or a link
 * preview as ordinary text.
 */
// A lesson whose content is visible at time zero. The reference lesson's is not —
// see the "blank first frame" suite below, which is the more interesting case.
const visibleAtZero = lessonOf([
  slide([element({ id: 'title', startMs: 0, endMs: 8000, effects: [], payload: { text: 'Workplace Safety' } })]),
])

describe('server-rendered content', () => {
  it('includes text that is visible at time zero', () => {
    expect(server(h(LessonPlayer, { lesson: visibleAtZero }))).toContain('Workplace Safety')
  })

  it('renders the text as text, not as an attribute or a script payload', () => {
    const stripped = server(h(LessonPlayer, { lesson: visibleAtZero })).replace(/<[^>]+>/g, ' ')
    expect(stripped).toContain('Workplace Safety')
  })

  it('emits no script tag of its own — the markup stands alone', () => {
    expect(server(h(LessonPlayer, { lesson: visibleAtZero }))).not.toMatch(/<script/i)
  })

  it('carries the lesson language for assistive technology', () => {
    expect(server(h(LessonPlayer, { lesson: referenceLesson }))).toMatch(/lang="en-GB"/)
  })

  it.each(corpus().map((c) => [c.name, c.lesson] as const))(
    'renders %s without throwing',
    (_name, lesson) => {
      expect(() => server(h(LessonPlayer, { lesson }))).not.toThrow()
    },
  )
})

/**
 * A finding, recorded rather than worked around.
 *
 * The reference lesson's first slide has NO content at time zero: its title fades in
 * at 500ms and its accent bar at 1000ms. So its server-rendered first frame is an
 * empty stage — technically correct per FR-002, and a defeat of FR-001's purpose,
 * because the learner with scripts disabled sees nothing.
 *
 * This is an authoring hazard, not a renderer bug. The renderer must show time zero;
 * it cannot invent content the author placed later. What it means is that "server-
 * render your lesson" is only valuable for lessons whose first slide starts visible,
 * and an author has no way to know that today. Wave 5's validation engine is where a
 * warning belongs — it already reports slides with no visible content.
 */
describe('a lesson blank at time zero', () => {
  it('renders an empty stage for the reference lesson, correctly', () => {
    const html = server(h(LessonPlayer, { lesson: referenceLesson }))
    expect(html).toContain('cs-stage')
    expect(html).not.toContain('data-cs-element-id')
  })

  it('still emits the stage at the authored proportions, so nothing shifts later', () => {
    const html = server(h(LessonPlayer, { lesson: referenceLesson }))
    expect(html).toMatch(/--cs-canvas-w:\s*1600/)
    expect(html).toMatch(/data-cs-aspect="16:9"/)
  })
})
