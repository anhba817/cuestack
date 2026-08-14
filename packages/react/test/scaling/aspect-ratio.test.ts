import { describe, expect, it } from 'vitest'
import { declarationsFor, stageBox } from '../harness/css.js'
import { lessonOf, slide } from '../harness/corpus.js'
import { stageProperties } from '../../src/theme/tokens.js'
import type { AspectRatio } from '@cuestack/schema'

/**
 * US3 #1, #5 · SC-005 · FR-009.
 *
 * The authored ratio must hold at every width, and it must be the *authored* one
 * rather than the container's — a 9:16 lesson in a desktop window stays tall.
 *
 * These are assertions about what the stylesheet computes, not about measured pixels.
 * That is not a limitation of the test environment; it is the requirement. If proving
 * this needed a measurement, the implementation would have needed one too, and FR-009
 * forbids exactly that.
 */

const RATIOS: readonly AspectRatio[] = ['16:9', '4:3', '9:16']

/** 320 is the narrowest width SC-005 names; 2560 the widest. */
const WIDTHS = [320, 375, 414, 768, 1024, 1280, 1440, 1920, 2560]

const varsFor = (aspectRatio: AspectRatio): Record<string, string> =>
  stageProperties(lessonOf([slide([])], {}, { aspectRatio })) as Record<string, string>

const authored = (aspectRatio: AspectRatio): number => {
  const [w, h] = aspectRatio.split(':').map(Number) as [number, number]
  return w / h
}

describe('the authored aspect ratio survives every width', () => {
  describe.each(RATIOS)('a %s lesson', (aspectRatio) => {
    const vars = varsFor(aspectRatio)

    it.each(WIDTHS)('keeps its proportions at %ipx', (width) => {
      const box = stageBox(width, vars)
      expect(box.w / box.h).toBeCloseTo(authored(aspectRatio), 5)
    })

    it('declares a logical canvas at the authored ratio', () => {
      // The canvas dimensions are what element coordinates are relative to. If they
      // disagreed with the aspect ratio, authored geometry would stretch.
      const w = Number(vars['--cs-canvas-w'])
      const h = Number(vars['--cs-canvas-h'])
      expect(w / h).toBeCloseTo(authored(aspectRatio), 5)
    })

    it('scales linearly rather than snapping to breakpoints', () => {
      // Two widths one pixel apart must differ by one pixel's worth of height. A
      // media-query ladder would satisfy every assertion above and fail this one.
      const a = stageBox(1000, vars)
      const b = stageBox(1001, vars)
      expect(b.h - a.h).toBeCloseTo(1 / authored(aspectRatio), 5)
    })
  })

  it('prefers the authored ratio over the container shape', () => {
    // US3 #5 stated as the case that would actually be got wrong: a portrait lesson in
    // a landscape window. A stage sized to its container would come out landscape.
    const box = stageBox(1920, varsFor('9:16'))
    expect(box.h).toBeGreaterThan(box.w)
  })

  it('derives the ratio from custom properties, not a literal', () => {
    // A literal `16 / 9` would pass every assertion above for one lesson and silently
    // mis-shape the other two.
    const ratio = declarationsFor('.cs-stage')['aspect-ratio']
    expect(ratio).toContain('var(--cs-canvas-w')
    expect(ratio).toContain('var(--cs-canvas-h')
  })

  it('declares no height, so nothing overrides the ratio', () => {
    const stage = declarationsFor('.cs-stage')
    expect(stage['height']).toBeUndefined()
    expect(stage['min-height']).toBeUndefined()
  })
})
