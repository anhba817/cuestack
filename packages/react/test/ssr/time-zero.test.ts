import { describe, expect, it } from 'vitest'
import { server } from '../harness/render.js'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { LessonPlayer } from '../../src/server.js'
import { createElement as h } from 'react'

/**
 * US1 #3 / FR-002. The server shows time zero — a real frame of the lesson, not a
 * guess and not an averaged state. An element entering later must be absent, which is
 * also what a learner with scripts disabled correctly sees.
 */
describe('the server renders time zero', () => {
  const lesson = lessonOf([
    slide([
      element({ id: 'immediate', startMs: 0, endMs: 8000, effects: [], payload: { text: 'Now' } }),
      element({ id: 'later', startMs: 500, endMs: 8000, effects: [], payload: { text: 'Soon' } }),
    ]),
  ])

  it('includes an element visible at zero', () => {
    expect(server(h(LessonPlayer, { lesson }))).toContain('Now')
  })

  it('excludes an element that enters later', () => {
    expect(server(h(LessonPlayer, { lesson }))).not.toContain('Soon')
  })

  it('does not pre-emptively show a later element at reduced opacity', () => {
    const html = server(h(LessonPlayer, { lesson }))
    expect(html).not.toContain('data-cs-element-id="later"')
  })
})
