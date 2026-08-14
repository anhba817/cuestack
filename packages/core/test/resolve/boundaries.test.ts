import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { corpus, effect, slide, textElement } from '../harness/corpus.js'

/** US1 #1 and #5: exact boundaries, and times outside the slide. */
describe('resolve boundaries', () => {
  it('flips visibility on the exact millisecond', () => {
    const s = slide([textElement({ startMs: 2000, endMs: 5000, effects: [] })])
    expect(resolve(s, 1999).elements).toHaveLength(0)
    expect(resolve(s, 2000).elements).toHaveLength(1)
  })

  it('returns a valid state for a negative time', () => {
    const state = resolve(slide([textElement()]), -1000)
    expect(state.timeMs).toBe(-1000)
    expect(state.elements).toEqual([])
    expect(state.blocked).toBeNull()
  })

  it('returns a valid state past the slide duration', () => {
    const s = slide([textElement({ endMs: 8000, effects: [] })], { durationMs: 8000 })
    const state = resolve(s, 99999)
    expect(state.elements).toEqual([])
    expect(state.blocked).toBeNull()
  })

  it('resolves mid-exit as partly gone rather than fully present or absent', () => {
    const s = slide([
      textElement({
        startMs: 0,
        endMs: 4000,
        effects: [effect({ type: 'disappear', phase: 'exit', startMs: 3000, durationMs: 1000, order: 1 })],
      }),
    ])
    const midExit = resolve(s, 3500).elements[0]!
    expect(midExit.opacity).toBeGreaterThan(0)
    expect(midExit.opacity).toBeLessThan(1)
  })

  it('never throws across every corpus boundary', () => {
    for (const { slide: s, boundaries } of corpus()) {
      for (const t of boundaries) expect(() => resolve(s, t)).not.toThrow()
    }
  })
})
