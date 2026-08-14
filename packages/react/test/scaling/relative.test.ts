import { describe, expect, it } from 'vitest'
import { declarationsFor, elementBox, resolveValue, stageBox, stylesheet } from '../harness/css.js'
import { lessonOf, slide } from '../harness/corpus.js'
import { stageProperties } from '../../src/theme/tokens.js'

/**
 * US3 #3 · FR-010.
 *
 * Two elements 100 logical units apart stay proportionally that far apart at every
 * width. Sizes too: an author who draws a square must get a square.
 *
 * The failure this is written to catch is an axis mix-up —
 * `calc(var(--cs-y) / var(--cs-canvas-w) * 100cqh)` reads plausibly, has the right
 * shape, and skews every layout. Text assertions about the declaration would pass it.
 */

const WIDTHS = [320, 768, 1024, 1920, 2560]

const stageVars = stageProperties(lessonOf([slide([])])) as Record<string, string>
const CANVAS_W = Number(stageVars['--cs-canvas-w'])
const CANVAS_H = Number(stageVars['--cs-canvas-h'])

const el = (x: number, y: number, w = 200, h = 100): Record<string, string> => ({
  '--cs-x': String(x),
  '--cs-y': String(y),
  '--cs-w': String(w),
  '--cs-h': String(h),
})

describe('relative geometry is preserved at every width', () => {
  it.each(WIDTHS)('keeps a 100-unit horizontal gap proportional at %ipx', (width) => {
    const a = elementBox(width, stageVars, el(100, 100))
    const b = elementBox(width, stageVars, el(200, 100))
    const stage = stageBox(width, stageVars)
    expect((b.left - a.left) / stage.w).toBeCloseTo(100 / CANVAS_W, 6)
  })

  it.each(WIDTHS)('keeps a 100-unit vertical gap proportional at %ipx', (width) => {
    const a = elementBox(width, stageVars, el(100, 100))
    const b = elementBox(width, stageVars, el(100, 200))
    const stage = stageBox(width, stageVars)
    expect((b.top - a.top) / stage.h).toBeCloseTo(100 / CANVAS_H, 6)
  })

  it('holds the same proportion across every width, not merely within each', () => {
    // The per-width assertions above would all pass if each width used a different
    // constant. This is the one that says the proportion is one number.
    const fractions = WIDTHS.map((width) => {
      const a = elementBox(width, stageVars, el(100, 100))
      const b = elementBox(width, stageVars, el(200, 100))
      return (b.left - a.left) / stageBox(width, stageVars).w
    })
    for (const fraction of fractions) expect(fraction).toBeCloseTo(fractions[0]!, 8)
  })

  it.each(WIDTHS)('renders a logical square as a square at %ipx', (width) => {
    // True only because the logical canvas carries the stage's own ratio, which makes
    // one logical unit the same length on both axes. An element sized off the wrong
    // axis breaks this at every width but 16:9's coincidental one.
    const box = elementBox(width, stageVars, el(0, 0, 300, 300))
    expect(box.width).toBeCloseTo(box.height, 6)
  })

  it.each(WIDTHS)('places an element at its authored fraction of the stage at %ipx', (width) => {
    const stage = stageBox(width, stageVars)
    const box = elementBox(width, stageVars, el(400, 225, 800, 450))
    expect(box.left / stage.w).toBeCloseTo(400 / CANVAS_W, 6)
    expect(box.top / stage.h).toBeCloseTo(225 / CANVAS_H, 6)
    expect(box.width / stage.w).toBeCloseTo(800 / CANVAS_W, 6)
    expect(box.height / stage.h).toBeCloseTo(450 / CANVAS_H, 6)
  })

  it.each(WIDTHS)('scales a blur radius with the stage at %ipx', (width) => {
    // FR-010 says *sizes*, not only positions, and a blur radius is a size. Fixed at
    // `8px` a blur authored to soften an edge on a desktop obliterates the element on a
    // phone, because the element shrank and the blur did not.
    const stage = stageBox(width, stageVars)
    const filter = declarationsFor('.cs-element')['filter']!
    // blur() is last in the declaration, so a greedy match to the final paren is exact.
    const arg = /blur\((.*)\)\s*$/.exec(filter)?.[1]
    expect(arg, `no blur() in ${filter}`).toBeDefined()
    const resolved = resolveValue(arg!, { ...stageVars, '--cs-blur': '16' }, stage)
    expect(resolved).toBeCloseTo((16 / CANVAS_W) * stage.w, 6)
  })

  it('resolves each axis against its own canvas dimension', () => {
    // A mutation check found `top: calc(var(--cs-y) / var(--cs-canvas-w) * 100cqw)`
    // undetectable by every assertion above — and it is genuinely equivalent, because
    // the stage's ratio equals the canvas's, which makes the two axes interchangeable.
    //
    // Pinned anyway. The equivalence is a consequence of how canvases are chosen today,
    // not a property of the mechanism, and the day a canvas is set independently of the
    // ratio the skew would appear with no test attached to it.
    const decls = declarationsFor('.cs-element')
    expect(decls['left']).toContain('--cs-canvas-w')
    expect(decls['width']).toContain('--cs-canvas-w')
    expect(decls['top']).toContain('--cs-canvas-h')
    expect(decls['height']).toContain('--cs-canvas-h')
    expect(decls['top']).not.toContain('--cs-canvas-w')
    expect(decls['height']).not.toContain('--cs-canvas-w')
  })

  it('preserves proportions on a portrait canvas too', () => {
    const portrait = stageProperties(
      lessonOf([slide([])], {}, { aspectRatio: '9:16' }),
    ) as Record<string, string>
    const stage = stageBox(600, portrait)
    const box = elementBox(600, portrait, el(0, 0, 300, 300))
    expect(box.width / stage.w).toBeCloseTo(300 / Number(portrait['--cs-canvas-w']), 6)
    expect(box.width).toBeCloseTo(box.height, 6)
  })
})

/**
 * The stage must actually *be* the container the assertions above assume.
 *
 * This is the one thing the evaluator cannot infer: it is handed a container box, so a
 * stylesheet that never established a container would resolve identically under test and
 * completely differently in a browser. Every `cqw` above would fall back to the small
 * viewport, and an embedded player would size itself to the window instead of to the box
 * a host gave it (research R-01).
 *
 * Found by mutating the stylesheet — deleting `container-type` killed no assertion.
 */
describe('the stage is the query container', () => {
  it('declares a size container', () => {
    expect(declarationsFor('.cs-stage')['container-type']).toBe('size')
  })

  it('names it, so a nested stage cannot capture the query', () => {
    expect(declarationsFor('.cs-stage')['container-name']).toBe('cs-stage')
  })

  it('uses container units and never viewport units', () => {
    // `vw`/`vh` would work on a full-page player and break every embedded one, which is
    // the failure mode that looks fine in the example app and fails in a host.
    const css = stylesheet()
    expect(css).not.toMatch(/\d(?:vw|vh|vmin|vmax|dvh|svh|lvh)\b/)
    expect(css).toMatch(/100cqw/)
    expect(css).toMatch(/100cqh/)
  })
})
