import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { largeSlide } from '../harness/corpus.js'

/**
 * SC-001: a 300-element slide resolves in under 10ms, leaving the rest of
 * NFR-PERF-003's 100ms seek budget to whatever draws the result.
 *
 * The authoritative measurement is the reference CI runner; a local number is
 * indicative. The budget matters less than the shape: cost must grow linearly with
 * element count, because a quadratic composition step would pass at 300 and fail
 * silently at the first lesson someone actually builds.
 */
function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}

function timeResolve(slide: ReturnType<typeof largeSlide>, runs = 15): number {
  const times: number[] = []
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    resolve(slide, 4000)
    times.push(performance.now() - start)
  }
  return median(times)
}

describe('resolution performance', () => {
  it('resolves 300 elements within the 10ms budget', () => {
    const slide = largeSlide(300)
    expect(resolve(slide, 4000).elements.length).toBeGreaterThan(0)
    timeResolve(slide, 5) // warm
    expect(timeResolve(slide)).toBeLessThan(10)
  })

  it('grows linearly rather than quadratically', () => {
    // Compared as cost *per element*, not as a ratio of totals. At the sizes the
    // budget cares about, a 300-element slide resolves in ~0.02ms — so a ratio of
    // totals measures timer granularity, not the algorithm. Per-element cost is
    // flat under linear growth and rises under quadratic, whatever the noise floor.
    const sizes = [600, 1200, 2400]
    const perElement = sizes.map((n) => {
      const slide = largeSlide(n)
      timeResolve(slide, 8) // warm the JIT before measuring
      return timeResolve(slide, 30) / n
    })

    const [smallest] = perElement
    for (const cost of perElement) {
      // Quadratic growth would double per-element cost at each step; 3x headroom
      // catches that while tolerating measurement noise.
      expect(cost).toBeLessThan(smallest! * 3)
    }
  })

  it('a 50-slide lesson resolves every slide within budget', () => {
    const slides = Array.from({ length: 50 }, () => largeSlide(6))
    const start = performance.now()
    for (const slide of slides) resolve(slide, 4000)
    expect(performance.now() - start).toBeLessThan(50)
  })
})
