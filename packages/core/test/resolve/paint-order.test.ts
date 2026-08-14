import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { slide, textElement } from '../harness/corpus.js'

/**
 * FR-007: elements arrive in paint order.
 *
 * Pre-sorted rather than left to the consumer: two consumers sorting
 * independently is two chances to sort differently, and a difference in paint
 * order is exactly the preview-player divergence Principle V exists to prevent.
 */
describe('paint order', () => {
  it('sorts by authored zIndex regardless of array order', () => {
    const s = slide([
      textElement({ id: 'top', zIndex: 9, effects: [] }),
      textElement({ id: 'bottom', zIndex: 1, effects: [] }),
      textElement({ id: 'middle', zIndex: 5, effects: [] }),
    ])
    expect(resolve(s, 0).elements.map((e) => e.id)).toEqual(['bottom', 'middle', 'top'])
  })

  it('breaks ties by array position, so equal zIndex is still deterministic', () => {
    const s = slide([
      textElement({ id: 'first', zIndex: 3, effects: [] }),
      textElement({ id: 'second', zIndex: 3, effects: [] }),
    ])
    expect(resolve(s, 0).elements.map((e) => e.id)).toEqual(['first', 'second'])
  })

  it('carries zIndex through for reference', () => {
    const s = slide([textElement({ zIndex: 7, effects: [] })])
    expect(resolve(s, 0).elements[0]!.zIndex).toBe(7)
  })
})
