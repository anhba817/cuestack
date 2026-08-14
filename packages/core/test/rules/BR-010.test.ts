import { describe, expect, it } from 'vitest'
import { resolve } from '../../src/resolve/index.js'
import { slide, textElement } from '../harness/corpus.js'

/** BR-010 — author-hidden elements are absent while remaining in the definition. */
describe('BR-010', () => {
  it('a hidden element never appears in the resolved state', () => {
    const s = slide([
      textElement({ id: 'shown', hidden: false, effects: [] }),
      textElement({ id: 'gone', hidden: true, effects: [] }),
    ])
    for (let t = 0; t < 8000; t += 500) {
      expect(resolve(s, t).elements.map((e) => e.id)).toEqual(['shown'])
    }
  })

  it('the element remains in the definition — hiding is not deletion', () => {
    const s = slide([textElement({ id: 'gone', hidden: true, effects: [] })])
    expect(s.elements).toHaveLength(1)
    expect(resolve(s, 0).elements).toHaveLength(0)
  })
})
