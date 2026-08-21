import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * FR-009, and the claim this whole package exists to test: **the same kernel, not a second one.**
 *
 * A source-level check rather than a behavioural one, for the same reason `headless.test.ts` is: a
 * second resolver that happened to agree today would pass any behavioural comparison and diverge the
 * first time the kernel changed.
 *
 * It is also the plan's stop condition — *if the adapter needs its own resolve or its own clock, stop
 * and report rather than fork* — and a stop condition nothing can trigger is a sentence.
 */
const SRC = join(import.meta.dirname, '..', 'src')

const read = (file: string): string => readFileSync(join(SRC, file), 'utf8')

const files = (): string[] =>
  readdirSync(SRC, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.ts'))

/** Sources as written, comments included — for the checks that ask what a file *imports*. */
const sources = (): string[] => files().map(read)

/**
 * Sources with comments stripped, for the checks that ask what a file *does*.
 *
 * Needed the moment a comment explained the mistake it was avoiding: the header on
 * `#advanceIfDue` says a `slideTimeMs >= durationMs` comparison would have been wrong, and the
 * pattern-matching check duly found that sentence and failed on it. A test that cannot tell code
 * from prose punishes explaining yourself, which is the opposite of what these comments are for.
 */
const code = (): string[] =>
  sources().map((source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))

describe('the kernel is shared, not copied', () => {
  it('imports resolution, timing, and the advance rule from core', () => {
    const all = sources().join('\n')
    expect(all).toContain("from '@cuestack/core'")
    expect(all).toMatch(/\bresolve\b/)
    expect(all).toMatch(/\bcreateTransport\b/)
    /**
     * `createAdvanceController` is here because its absence was the gap.
     *
     * The first draft of this file checked `resolve` and `createTransport` and stopped, so an
     * adapter that never advanced a slide at all passed every structural claim about sharing the
     * kernel — truthfully, since it shared everything it used. FR-009 is about every rule the
     * kernel owns, and a `slideTimeMs >= durationMs` comparison written here would have been three
     * lines and wrong about `after_media_ends`, `after_interaction`, and the per-instance decision
     * that lets a learner replay a slide.
     */
    expect(all).toMatch(/\bcreateAdvanceController\b/)
  })

  it('defines neither', () => {
    for (const source of code()) {
      expect(source).not.toMatch(/function\s+resolve\s*\(/)
      expect(source).not.toMatch(/function\s+createTransport\s*\(/)
      expect(source).not.toMatch(/function\s+createClock\s*\(/)
      expect(source).not.toMatch(/function\s+createAdvanceController\s*\(/)
      /**
       * The shape a hand-rolled advance takes: slide time compared against a duration.
       *
       * Written loosely on purpose. The first version was `slideTimeMs\s*>=?\s*\w*[Dd]urationMs`,
       * which reads tight and matched nothing real — the actual mistake looks like
       * `transport.slideTimeMs >= (slide.durationMs as number)`, and a parenthesis defeated it. It
       * passed its own negative control, which is the only reason that was found.
       */
      expect(source).not.toMatch(/slideTimeMs[\s\S]{0,40}[<>]=?[\s\S]{0,40}durationMs/i)
    }
  })

  it('writes no clamp of its own', () => {
    // `CLAMP_CEILING_MS` lives in core's clock: machine sleep and a paused debugger produce enormous
    // deltas and none of them happened to the learner. An adapter with its own would lose that.
    for (const source of code()) {
      expect(source).not.toMatch(/CLAMP|Math\.min\(\s*delta/)
    }
  })

  it('implements no effect', () => {
    // Effects are the kernel's. A second implementation is the divergence FR-009 forbids.
    for (const source of code()) {
      expect(source).not.toMatch(/easing|cubicBezier|applyEasing/i)
    }
  })

  it('imports no UI framework', () => {
    for (const source of sources()) {
      expect(source).not.toMatch(/from '(react|react-dom|@cuestack\/react)/)
    }
  })
})
