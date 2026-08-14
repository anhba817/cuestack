import { describe, expect, it } from 'vitest'
import { server } from '../harness/render.js'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { LessonPlayer } from '../../src/server.js'
import { createElement as h } from 'react'

/**
 * US1 #5. An unregistered optional type must leave the rest of the slide rendered.
 *
 * Shipping a lesson that uses a plugin to a host that lacks it should lose the
 * element, not the lesson — the asymmetry the kernel already establishes, carried
 * through to what a learner sees.
 */
describe('an unregistered optional element type', () => {
  const lesson = lessonOf([
    slide([
      element({ id: 'known', effects: [], payload: { text: 'Still here' } }),
      element({ id: 'exotic', type: 'hologram', effects: [], payload: {} }),
    ]),
  ])

  it('does not prevent the slide from rendering', () => {
    expect(server(h(LessonPlayer, { lesson }))).toContain('Still here')
  })

  it('renders a placeholder that reserves the element\'s space', () => {
    const html = server(h(LessonPlayer, { lesson }))
    expect(html).toContain('cs-placeholder')
    expect(html).toContain('data-cs-element-id="exotic"')
  })

  it('announces the placeholder as unavailable rather than leaving it silent', () => {
    const html = server(h(LessonPlayer, { lesson }))
    expect(html).toMatch(/unavailable/i)
  })
})
