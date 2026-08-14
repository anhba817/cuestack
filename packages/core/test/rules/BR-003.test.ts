import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { slide, textElement } from '../harness/corpus.js'

/** BR-003 — element visible on [startMs, endMs), absent at and after endMs. */
describe('BR-003', () => {
  it('an element is visible up to but not including endMs', () => {
    const s = slide([textElement({ startMs: 0, endMs: 1000, effects: [] })])
    expect(resolve(s, 999).elements).toHaveLength(1)
    expect(resolve(s, 1000).elements).toHaveLength(0)
    expect(resolve(s, 1001).elements).toHaveLength(0)
  })

  it('the visibility window is half-open so adjacent elements never both show', () => {
    const s = slide([
      textElement({ id: 'first', startMs: 0, endMs: 500, effects: [] }),
      textElement({ id: 'second', startMs: 500, endMs: 1000, effects: [] }),
    ])
    const ids = resolve(s, 500).elements.map((e) => e.id)
    expect(ids).toEqual(['second'])
  })
})
