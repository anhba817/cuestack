import { describe, expect, it } from 'vitest'
import { validate } from '../src/validate/index.js'
import { reference } from './helpers.js'

/**
 * The Wave-0 sub-budget from plan.md: a manifest of 50 slides and 300 elements
 * IN TOTAL validates in under 500 ms.
 *
 * It exists so validation can never be the reason NFR-PERF-001's 3-second
 * editor-interactive budget is missed later. The authoritative measurement is
 * the reference CI runner; a local number is indicative.
 */
function buildLargeManifest(slideCount: number, totalElements: number) {
  const base = reference()
  const perSlide = Math.floor(totalElements / slideCount)
  const slides = Array.from({ length: slideCount }, (_, s) => ({
    id: `slide_${s}`,
    name: `Slide ${s}`,
    durationMs: 8000,
    advance: { mode: 'after_duration' as const },
    elements: Array.from({ length: perSlide }, (_, e) => ({
      id: `slide_${s}_element_${e}`,
      type: 'text' as const,
      x: e * 10,
      y: e * 10,
      width: 200,
      height: 60,
      zIndex: e,
      startMs: e * 100,
      endMs: 8000,
      payload: { text: `Element ${e} on slide ${s}` },
      effects: [
        {
          id: `slide_${s}_element_${e}_enter`,
          type: 'fade' as const,
          phase: 'enter' as const,
          startMs: e * 100,
          durationMs: 300,
          order: 1,
        },
      ],
    })),
  }))
  return { ...base, slides }
}

describe('validation performance', () => {
  it('validates 50 slides / 300 elements within the 500 ms budget', () => {
    const manifest = buildLargeManifest(50, 300)
    const structural = validate(manifest)
    expect(structural.ok).toBe(true)

    const start = performance.now()
    validate(manifest)
    const elapsed = performance.now() - start

    console.log(`perf: validate 50 slides/300 elements | ${elapsed} | ${500}`)
    expect(elapsed).toBeLessThan(500)
  })

  it('scales without a cliff between 300 and 600 elements', () => {
    // Not a hard budget — a guard against accidentally quadratic behaviour in
    // the referential pass, which walks every element against every advance rule.
    const small = buildLargeManifest(50, 300)
    const large = buildLargeManifest(50, 600)

    const time = (m: unknown) => {
      const start = performance.now()
      validate(m)
      return performance.now() - start
    }
    time(small) // warm

    const ratio = time(large) / Math.max(time(small), 0.1)
    console.log(`perf: validation scaling 300 to 600 | ${ratio} | ${6}`)
    expect(ratio).toBeLessThan(6)
  })
})
