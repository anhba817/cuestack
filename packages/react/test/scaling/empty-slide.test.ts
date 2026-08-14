import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { declarationsFor, stageBox } from '../harness/css.js'
import { lessonOf, slide } from '../harness/corpus.js'
import { stageProperties } from '../../src/theme/tokens.js'
import { server } from '../harness/render.js'
import { LessonPlayer } from '../../src/server.js'

/**
 * Spec Edge Cases: a slide with nothing visible.
 *
 * It must hold its shape rather than collapsing to nothing. This is not a hypothetical
 * — the reference lesson's own first slide is empty at time zero, because its title
 * fades in at 500 ms. A stage that collapses when empty would make that lesson's
 * server-rendered frame a zero-height box, and then grow when the title appeared:
 * exactly the layout shift SC-004 forbids.
 */

const emptyLesson = lessonOf([slide([])])
const stageVars = stageProperties(emptyLesson) as Record<string, string>

describe('an empty slide holds the stage open', () => {
  it('renders a stage', () => {
    const markup = server(h(LessonPlayer, { lesson: emptyLesson }))
    expect(markup).toContain('cs-stage')
    expect(markup).toMatch(/--cs-canvas-w:\s*1600/)
  })

  it('renders no elements', () => {
    expect(server(h(LessonPlayer, { lesson: emptyLesson }))).not.toContain('cs-element')
  })

  it.each([320, 768, 1920])('still has height at %ipx', (width) => {
    const box = stageBox(width, stageVars)
    expect(box.h).toBeGreaterThan(0)
    expect(box.w / box.h).toBeCloseTo(16 / 9, 5)
  })

  it('takes its height from the ratio rather than from its contents', () => {
    // `aspect-ratio` with a definite width is what makes the box independent of what is
    // inside it. Nothing about the height may be content-derived.
    const stage = declarationsFor('.cs-stage')
    expect(stage['aspect-ratio']).toBeDefined()
    expect(stage['width']).toBe('100%')
    expect(stage['height']).toBeUndefined()
  })

  it('gives the empty stage a defined surface rather than borrowing the host page', () => {
    // Without this an empty stage is invisible, and "nothing rendered" and "rendered
    // nothing" look the same to whoever is debugging it.
    expect(declarationsFor('.cs-stage')['background']).toContain('--cs-theme-surface-default')
  })
})
