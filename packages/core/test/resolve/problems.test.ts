import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { effect, slide, textElement } from '../harness/corpus.js'

/**
 * Spec edge cases 1 and 5: content extending past the slide's end is *reported*,
 * not silently clipped. A teacher who shortened a slide needs to know what they
 * cut off; discovering it from a learner is too late.
 */
describe('problem reporting', () => {
  it('reports an effect that extends past the slide end', () => {
    const s = slide(
      [
        textElement({
          id: 'overrun',
          startMs: 0,
          endMs: 8000,
          effects: [effect({ id: 'late', startMs: 7900, durationMs: 500, order: 1 })],
        }),
      ],
      { durationMs: 8000 },
    )
    const state = resolve(s, 7950)
    const problem = state.problems.find((p) => p.code === 'EFFECT_BEYOND_SLIDE')
    expect(problem).toBeDefined()
    expect(problem?.elementId).toBe('overrun')
    expect(problem?.effectId).toBe('late')
  })

  it('reports an element whose window extends past the slide end', () => {
    const s = slide([textElement({ id: 'long', startMs: 0, endMs: 12000, effects: [] })], {
      durationMs: 8000,
    })
    const problem = resolve(s, 0).problems.find((p) => p.code === 'ELEMENT_BEYOND_SLIDE')
    expect(problem).toBeDefined()
    expect(problem?.elementId).toBe('long')
  })

  it('does not clip: the element still resolves within the slide', () => {
    const s = slide([textElement({ id: 'long', startMs: 0, endMs: 12000, effects: [] })], {
      durationMs: 8000,
    })
    expect(resolve(s, 4000).elements.map((e) => e.id)).toEqual(['long'])
  })

  it('reports nothing for a slide whose content fits', () => {
    const s = slide([textElement({ startMs: 0, endMs: 4000, effects: [] })], { durationMs: 8000 })
    expect(resolve(s, 0).problems).toEqual([])
  })

  it('problems are stable across repeated resolutions', () => {
    const s = slide([textElement({ startMs: 0, endMs: 12000, effects: [] })], { durationMs: 8000 })
    expect(JSON.stringify(resolve(s, 0).problems)).toBe(JSON.stringify(resolve(s, 0).problems))
  })
})
