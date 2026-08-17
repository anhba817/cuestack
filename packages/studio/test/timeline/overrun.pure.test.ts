import { describe, expect, it } from 'vitest'
import { resolve } from '@cuestack/core'
import { overrunsOf, requiredDurationMs, isWholeSlideOverrun } from '../../src/timeline/overrun.js'
import { element, slide } from '../harness/corpus.js'
import { effect } from '../harness/timeline.js'

/**
 * The editor detects nothing here.
 *
 * `collectProblems` has emitted both overrun codes on every resolve since Wave 1, and nothing
 * has ever read them — three features carried the problems unexamined. US5 is a *consumer*
 * for a mechanism that already exists, which is the same shape as feature 005 finding
 * `ElementPlugin.inspector` unused.
 */

describe('overrunsOf', () => {
  it('reports an element ending after the slide, attributed to it (FR-037)', () => {
    const el = element({ startMs: 0, endMs: 12_000 })
    const problems = overrunsOf(resolve(slide([el], { durationMs: 8000 }), 0))

    expect(problems).toHaveLength(1)
    expect(problems[0]!.code).toBe('ELEMENT_BEYOND_SLIDE')
    expect(problems[0]!.elementId).toBe(el.id)
  })

  it('reports an effect that runs past the end, naming the effect as well', () => {
    const el = element({
      startMs: 0,
      endMs: 4000,
      effects: [effect({ id: 'fx-late', startMs: 7800, durationMs: 500 })],
    })
    const problems = overrunsOf(resolve(slide([el], { durationMs: 8000 }), 0))

    expect(problems.some((p) => p.code === 'EFFECT_BEYOND_SLIDE' && p.effectId === 'fx-late')).toBe(true)
  })

  it('says nothing when nothing overruns (US5 §5)', () => {
    const el = element({ startMs: 0, endMs: 4000 })
    expect(overrunsOf(resolve(slide([el], { durationMs: 8000 }), 0))).toEqual([])
  })

  it('invents no problems of its own — it passes the kernel’s through unchanged', () => {
    const el = element({ startMs: 0, endMs: 12_000 })
    const state = resolve(slide([el], { durationMs: 8000 }), 0)
    for (const problem of overrunsOf(state)) {
      expect(state.problems).toContain(problem)
    }
  })

  it('keeps the kernel’s wording, which already names the action (FR-040)', () => {
    const el = element({ startMs: 0, endMs: 12_000 })
    const [problem] = overrunsOf(resolve(slide([el], { durationMs: 8000 }), 0))
    expect(problem!.message).toMatch(/extend the slide|trim/i)
  })
})

describe('requiredDurationMs', () => {
  it('is the latest end across elements and effects', () => {
    const a = element({ startMs: 0, endMs: 9000 })
    const b = element({ startMs: 0, endMs: 4000, effects: [effect({ startMs: 11_000, durationMs: 500 })] })
    expect(requiredDurationMs(slide([a, b], { durationMs: 8000 }))).toBe(11_500)
  })

  it('is the slide’s own duration when nothing exceeds it', () => {
    expect(requiredDurationMs(slide([element({ startMs: 0, endMs: 4000 })], { durationMs: 8000 }))).toBe(8000)
  })

  it('handles an empty slide', () => {
    expect(requiredDurationMs(slide([], { durationMs: 8000 }))).toBe(8000)
  })
})

describe('a slide of zero duration', () => {
  /**
   * Legal — `Slide.durationMs` is `msInt`, integer >= 0 — and reachable for any slide that
   * advances on a click. `collectProblems` tests `endMs > durationMs` and every element has
   * `endMs >= 1`, so *every* element is reported. That is the kernel answering correctly; the
   * timeline must say it once, about the slide, rather than three hundred times about its
   * elements.
   */
  it('reports every element', () => {
    const elements = [element({ endMs: 1000 }), element({ endMs: 2000 }), element({ endMs: 3000 })]
    const problems = overrunsOf(resolve(slide(elements, { durationMs: 0 }), 0))
    expect(problems).toHaveLength(3)
  })

  it('is recognised as one problem about the slide, not many about its contents', () => {
    const elements = [element({ endMs: 1000 }), element({ endMs: 2000 })]
    const built = slide(elements, { durationMs: 0 })
    expect(isWholeSlideOverrun(built, overrunsOf(resolve(built, 0)))).toBe(true)
  })

  it('is not confused with one element overrunning a normal slide', () => {
    const elements = [element({ endMs: 12_000 }), element({ endMs: 2000 })]
    const built = slide(elements, { durationMs: 8000 })
    expect(isWholeSlideOverrun(built, overrunsOf(resolve(built, 0)))).toBe(false)
  })
})
