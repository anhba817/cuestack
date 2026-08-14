import { describe, expect, it } from 'vitest'
import { declarationsFor, resolveValue, stageBox } from '../harness/css.js'
import { lessonOf, slide } from '../harness/corpus.js'
import { stageProperties } from '../../src/theme/tokens.js'

/**
 * Spec Edge Cases: a large root font size.
 *
 * A learner who has set their browser's minimum font size, or zoomed text only, gets
 * larger text than the author sized. It must stay inside its element rather than
 * escaping across the slide.
 *
 * WCAG 2.2 1.4.4 is why this is not solved by refusing to grow: text has to be
 * resizable to 200% without loss of content or function. So the text grows and the
 * element contains it, which is the trade the container query mechanism makes anyway —
 * see the legibility floor in `scaling/clipping.test.ts`.
 */

const stageVars = stageProperties(lessonOf([slide([])])) as Record<string, string>

describe('text stays inside its element when the font is large', () => {
  const text = declarationsFor('.cs-element-text')

  it('clips rather than overflowing the element', () => {
    expect(text['overflow']).toBe('hidden')
  })

  it('breaks long words rather than pushing sideways', () => {
    // A single unbroken word wider than its element is the case that escapes without
    // this — a URL in a caption, most often.
    expect(text['overflow-wrap']).toBe('break-word')
  })

  it('sizes from the stage rather than from the root font', () => {
    // `rem` would make a learner's font preference resize lesson geometry, which
    // detaches text from the shapes it was positioned against. Container units keep the
    // authored composition, and the floor keeps it legible.
    expect(text['font-size']).toContain('cqw')
    expect(text['font-size']).not.toMatch(/\brem\b/)
    expect(text['font-size']).not.toMatch(/\bem\b/)
  })

  it('grows with the stage rather than pinning at the floor', () => {
    const small = resolveValue(text['font-size']!, stageVars, stageBox(320, stageVars))
    const large = resolveValue(text['font-size']!, stageVars, stageBox(1920, stageVars))
    expect(large).toBeGreaterThan(small)
  })

  it('gives the element a box the text is measured against', () => {
    // `box-sizing: border-box` on the frame, so an element's authored width is the width
    // its text has to fit into, padding included.
    expect(declarationsFor('.cs-element')['box-sizing']).toBe('border-box')
  })

  it('keeps a line height that survives being scaled up', () => {
    // A unitless line-height scales with the font. `line-height: 20px` would overlap
    // lines the moment the font grew past it.
    const lineHeight = text['line-height']
    expect(lineHeight).toBeDefined()
    expect(lineHeight).toMatch(/^\d+(\.\d+)?$/)
  })
})
