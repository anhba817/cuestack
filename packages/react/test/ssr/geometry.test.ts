import { describe, expect, it } from 'vitest'
import { server } from '../harness/render.js'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { LessonPlayer } from '../../src/server.js'
import { createElement as h } from 'react'

/**
 * US1 #2. Elements must be positioned in the server's markup, not stacked at the
 * origin awaiting a script. Positions arrive as custom properties in unitless
 * logical values — emitting `120px` would bake in a scale the server cannot know.
 */
describe('server-rendered geometry', () => {
  // Positioned at the reference lesson's authored coordinates, but visible at zero.
  const lesson = lessonOf([
    slide([element({ id: 'title', x: 120, y: 80, zIndex: 1, startMs: 0, endMs: 8000, effects: [] })]),
  ])
  const html = () => server(h(LessonPlayer, { lesson }))

  it('sets the canvas dimensions on the stage', () => {
    expect(html()).toMatch(/--cs-canvas-w:\s*1600/)
    expect(html()).toMatch(/--cs-canvas-h:\s*900/)
  })

  it("carries the title element's authored position", () => {
    // reference.json places element_title at x=120, y=80
    const markup = html()
    expect(markup).toMatch(/--cs-x:\s*120/)
    expect(markup).toMatch(/--cs-y:\s*80/)
  })

  it('emits logical units, never pixels', () => {
    expect(html()).not.toMatch(/--cs-x:\s*\d+px/)
  })

  it('carries the authored layer order', () => {
    expect(html()).toMatch(/--cs-z:\s*\d+/)
  })

  it('emits no inline left/top — positioning is the stylesheet\'s job', () => {
    const markup = html()
    expect(markup).not.toMatch(/style="[^"]*\bleft:/)
    expect(markup).not.toMatch(/style="[^"]*\btop:/)
  })
})
