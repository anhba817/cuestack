import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { heavyLesson } from '../fixtures/heavy-lesson.mjs'
import {
  FLOOR_MS,
  TARGET_MS,
  framesOverFloor,
  medianFrameMs,
  summarise,
} from '../../browser/statistics.mjs'

/**
 * The browser check's arithmetic, and the fixture it measures.
 *
 * **Two subjects in one file, deliberately.** Splitting them would add a second test file, which
 * moves the README's test-file count a second time — and that count is asserted by
 * `readme-claims.test.ts`. Both subjects are unit-level facts about the browser check's inputs.
 *
 * **It imports `statistics.mjs`, never `measure.mjs`.** The latter drives Playwright, and importing
 * it here would pull a browser driver into every `pnpm test`.
 */

const ROOT = resolve(import.meta.dirname, '..', '..', '..')

describe('the two statistics Constitution IV is measured against', () => {
  it('reports the typical frame as a median', () => {
    expect(medianFrameMs([10, 12, 11])).toBe(11)
    expect(medianFrameMs([10, 12, 11, 13])).toBe(11.5)
  })

  it('counts frames past the floor rather than averaging them away', () => {
    /**
     * **The case the whole choice exists for.** A lesson that holds 60 fps and stalls once per
     * slide: fifty-nine good frames and one 200ms stall. The mean is 19.8ms — under a 30 fps floor,
     * so a mean-based check calls this smooth. The person watching saw a freeze.
     */
    const frames = [...Array.from({ length: 59 }, () => 13), 200]
    const mean = frames.reduce((a, b) => a + b, 0) / frames.length

    expect(mean).toBeLessThan(FLOOR_MS)
    expect(medianFrameMs(frames)).toBe(13)
    expect(framesOverFloor(frames, FLOOR_MS)).toBe(1)
  })

  it('states both budgets as frame times, from the constitution rates', () => {
    expect(TARGET_MS).toBeCloseTo(16.67, 2)
    expect(FLOOR_MS).toBeCloseTo(33.33, 2)
  })

  it('refuses to summarise nothing rather than reporting a zero', () => {
    // A run that collected no frames measured nothing. Reporting 0ms would read as perfect.
    expect(() => summarise([])).toThrow(/no frames/)
  })
})

describe('the committed heavy lesson still matches its generator', () => {
  /**
   * **FR-009's neighbour problem.** 86KB of JSON committed beside the function that produces it is
   * two sources of truth, and it will drift: `heavyLesson()` changes, the file does not, and the
   * browser check quietly measures a different lesson than `pnpm gates` does.
   *
   * The generator is deterministic — no `Math.random`, `Date.now` or `process.env` in it — which is
   * what makes this assertion possible at all.
   */
  it('byte for byte', () => {
    const committed = readFileSync(join(ROOT, 'examples/nextjs/app/heavy-lesson.json'), 'utf8')
    expect(committed).toBe(JSON.stringify(heavyLesson()))
  })

  it('is the shape every other budget uses', () => {
    const lesson = heavyLesson() as { slides: readonly { elements: readonly unknown[] }[] }
    expect(lesson.slides).toHaveLength(50)
    expect(lesson.slides.reduce((n, s) => n + s.elements.length, 0)).toBe(300)
  })
})
