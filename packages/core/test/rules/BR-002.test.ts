import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { slide, textElement } from '../harness/corpus.js'

/** BR-002 — element start ≥ 0 honoured as a visibility boundary. */
describe('BR-002', () => {
  it('an element with startMs 0 is present at time 0', () => {
    const s = slide([textElement({ startMs: 0, endMs: 1000, effects: [] })])
    expect(resolve(s, 0).elements).toHaveLength(1)
  })

  it('an element is absent before its start', () => {
    const s = slide([textElement({ startMs: 500, endMs: 1000, effects: [] })])
    expect(resolve(s, 499).elements).toHaveLength(0)
    expect(resolve(s, 500).elements).toHaveLength(1)
  })

  it('a negative resolve time yields a valid state, not an error', () => {
    const s = slide([textElement({ startMs: 0, endMs: 1000, effects: [] })])
    const state = resolve(s, -100)
    expect(state.slideId).toBe(s.id)
    expect(state.elements).toHaveLength(0)
  })
})
