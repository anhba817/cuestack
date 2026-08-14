import { createElement as h } from 'react'
import { describe, expect, it } from 'vitest'
import { declarationsFor, elementBox, resolveValue, rules, stageBox } from '../harness/css.js'
import { element, lessonOf, slide } from '../harness/corpus.js'
import { stageProperties } from '../../src/theme/tokens.js'
import { server } from '../harness/render.js'
import { LessonPlayer } from '../../src/server.js'

/**
 * US3 #4 · FR-011 · FR-012.
 *
 * Content outside the canvas is clipped to the stage rather than extending the page.
 *
 * Note what is *not* the fix: dropping the element. That would also stop the page
 * scrolling, and it would be wrong — an element parked off-canvas is how an author
 * stages something to slide in, so it must exist in the markup and be hidden by the
 * stage's own bounds.
 */

const stageVars = stageProperties(lessonOf([slide([])])) as Record<string, string>

const offCanvas = element({ id: 'off', x: 1900, y: -200, width: 400, height: 200, effects: [] })
const lesson = lessonOf([slide([offCanvas])])

describe('off-canvas content is clipped, not spilled', () => {
  it('clips at the stage', () => {
    expect(declarationsFor('.cs-stage')['overflow']).toBe('hidden')
  })

  it('never re-enables overflow anywhere in the stylesheet', () => {
    // One `overflow: visible` on a descendant defeats the clip for everything inside it.
    const offenders = rules()
      .filter((r) => /visible|scroll|auto/.test(r.declarations['overflow'] ?? ''))
      .map((r) => r.selectors.join(', '))
    expect(offenders).toEqual([])
  })

  it('actually places the element outside the stage', () => {
    // Without this the suite would pass just as happily against an element that was
    // never off-canvas, proving nothing about clipping.
    const stage = stageBox(1024, stageVars)
    const box = elementBox(1024, stageVars, {
      '--cs-x': '1900',
      '--cs-y': '-200',
      '--cs-w': '400',
      '--cs-h': '200',
    })
    expect(box.left).toBeGreaterThan(stage.w)
    expect(box.top).toBeLessThan(0)
  })

  it('still renders the element, so it can animate into view later', () => {
    const markup = server(h(LessonPlayer, { lesson }))
    expect(markup).toMatch(/--cs-x:\s*1900/)
    expect(markup).toMatch(/--cs-y:\s*-200/)
  })

  it('cannot make the page wider than its container', () => {
    // FR-012 rests on these two declarations plus the clip: the stage fills the width
    // it is given and never asks for more, whatever it contains.
    const stage = declarationsFor('.cs-stage')
    expect(stage['width']).toBe('100%')
    expect(stage['max-width']).toBe('100%')
  })

  it('positions elements out of flow, so they cannot push the stage open', () => {
    // An element in normal flow would contribute to the stage's content size. Absolute
    // positioning is why a 400-unit-wide element at x=1900 has no effect on layout.
    expect(declarationsFor('.cs-element')['position']).toBe('absolute')
  })

  it('keeps the stage a positioned ancestor for them to resolve against', () => {
    expect(declarationsFor('.cs-stage')['position']).toBe('relative')
  })
})

/**
 * The other half of US3 #4, which is about legibility and not about overflow.
 *
 * No test task named it — T042–T046 cover proportions, distances, measurement,
 * clipping, and the empty slide, while T049 asks for "overflow clipping **and** the
 * minimum-legibility floor". The floor had an implementation task and no test, so it
 * lands here, with the clipping tests, because US3 #4 is the criterion both serve.
 */
describe('text stays legible at small sizes', () => {
  const MINIMUM_PX = 12

  const fontSizeAt = (width: number, selector: string): number => {
    const declared = declarationsFor(selector)['font-size']
    expect(declared, `${selector} declares no font-size`).toBeDefined()
    return resolveValue(declared!, stageVars, stageBox(width, stageVars))
  }

  it.each([320, 375, 414])('keeps body text at least %ipx-legible at narrow widths', (width) => {
    // A 32-unit heading on a 1600-unit canvas is 2% of the width: 6.4px at 320. Purely
    // proportional scaling is correct arithmetic and an unreadable lesson.
    expect(fontSizeAt(width, '.cs-element-text')).toBeGreaterThanOrEqual(MINIMUM_PX)
  })

  it.each([320, 375])('keeps the placeholder legible at %ipx', (width) => {
    expect(fontSizeAt(width, '.cs-placeholder')).toBeGreaterThanOrEqual(MINIMUM_PX)
  })

  it('scales proportionally above the floor rather than pinning the size', () => {
    // The floor must be a floor. A flat 16px everywhere would satisfy the assertions
    // above and destroy the proportional typography the whole mechanism exists for.
    const wide = fontSizeAt(2560, '.cs-element-text')
    const wider = fontSizeAt(1280, '.cs-element-text')
    expect(wide).toBeCloseTo(wider * 2, 5)
    expect(wide).toBeGreaterThan(MINIMUM_PX)
  })

  it('contains overflowing text rather than letting it escape its element', () => {
    // With a floor, text at narrow widths is larger than its proportional box. It must
    // wrap and clip: unreadable text conveys nothing, whereas clipped text conveys most
    // of itself and the clip is visible enough to be reported.
    const text = declarationsFor('.cs-element-text')
    expect(text['overflow']).toBe('hidden')
    expect(text['overflow-wrap']).toBe('break-word')
  })
})
