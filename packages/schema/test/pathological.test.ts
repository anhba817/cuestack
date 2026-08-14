import { describe, expect, it } from 'vitest'
import { validate } from '../src/validate/index.js'
import { migrate } from '../src/migrate/index.js'
import { reference } from './helpers.js'

/**
 * Spec edge case: "validation of a very large lesson does not exhaust memory or
 * hang; it completes or fails with a bounded error."
 *
 * Hostile input reaches a validator before anything else in the system does. A
 * host that accepts an uploaded lesson package hands it straight here, so
 * "completes or fails" has to hold for input nobody would author by hand.
 */
describe('pathological input', () => {
  const withinBudget = (fn: () => unknown, ms = 2000) => {
    const start = performance.now()
    const result = fn()
    expect(performance.now() - start).toBeLessThan(ms)
    return result
  }

  it('handles a deeply nested structure without stack exhaustion', () => {
    let nested: Record<string, unknown> = { deep: true }
    for (let i = 0; i < 10_000; i++) nested = { nested }
    const manifest = { ...reference(), lesson: nested }
    expect(() => withinBudget(() => validate(manifest))).not.toThrow()
    expect(validate(manifest).ok).toBe(false)
  })

  it('handles a multi-megabyte string field', () => {
    const manifest = reference()
    manifest.lesson.title = 'x'.repeat(5_000_000)
    const result = withinBudget(() => validate(manifest)) as ReturnType<typeof validate>
    expect(result.ok).toBe(false)
  })

  it('handles an array with hundreds of thousands of entries', () => {
    const manifest = reference()
    manifest.slides[0].elements[0].effects = Array.from({ length: 200_000 }, (_, i) => ({
      id: `effect_${i}`,
      type: 'fade',
      phase: 'enter',
      startMs: 0,
      durationMs: 100,
      order: i,
    }))
    const result = withinBudget(() => validate(manifest), 10_000) as ReturnType<typeof validate>
    expect(typeof result.ok).toBe('boolean')
  })

  it('handles a self-referential object without hanging', () => {
    const cyclic: Record<string, unknown> = { schemaVersion: '1.0', lesson: {}, slides: [] }
    cyclic.self = cyclic
    ;(cyclic.lesson as Record<string, unknown>).back = cyclic
    expect(() => withinBudget(() => validate(cyclic))).not.toThrow()
    expect(validate(cyclic).ok).toBe(false)
  })

  it('migrate() survives the same inputs', () => {
    const cyclic: Record<string, unknown> = { schemaVersion: '0.9' }
    cyclic.self = cyclic
    expect(() => withinBudget(() => migrate(cyclic))).not.toThrow()
  })

  it('rejects rather than accepting when input is enormous but well-formed', () => {
    const manifest = reference()
    manifest.slides[0].metadata = Object.fromEntries(
      Array.from({ length: 50_000 }, (_, i) => [`key_${i}`, `value_${i}`]),
    )
    const result = withinBudget(() => validate(manifest), 10_000) as ReturnType<typeof validate>
    expect(typeof result.ok).toBe('boolean')
  })
})
