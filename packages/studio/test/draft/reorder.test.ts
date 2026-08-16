import { describe, expect, it } from 'vitest'
import { resolve } from '@cuestack/core'
import { applyEdit } from '../../src/draft/reducer.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith, tied } from '../harness/corpus.js'

/**
 * T076 — FR-027, FR-028.
 *
 * Pure reducer assertions only: this suite runs in the node project with no DOM, and the
 * *rendered* comparison of editor paint order against player paint order belongs to the parity
 * suite, not to a second copy here.
 */
describe('reorder', () => {
  const ctx = () => ({ mode: 'edit' as const, nextId: countingIds() })
  const zOf = (draft: ReturnType<typeof lessonWith>) =>
    draft.slides[0]!.elements.map((e) => e.zIndex)

  it('moves an element forward', () => {
    const draft = lessonWith([element({ zIndex: 0 }), element({ zIndex: 1 })])
    const first = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(draft, { kind: 'reorder', ids: [first], direction: 'forward' }, ctx())

    if (!result.ok) throw new Error('expected success')
    const [a, b] = result.draft.slides[0]!.elements
    expect(a!.zIndex).toBeGreaterThan(b!.zIndex)
  })

  it('moves an element backward', () => {
    const draft = lessonWith([element({ zIndex: 5 }), element({ zIndex: 0 })])
    const first = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(draft, { kind: 'reorder', ids: [first], direction: 'backward' }, ctx())

    if (!result.ok) throw new Error('expected success')
    const [a, b] = result.draft.slides[0]!.elements
    expect(a!.zIndex).toBeLessThan(b!.zIndex)
  })

  /**
   * Normalisation is what makes "bring forward" actually move.
   *
   * Ties are legal in the format and the resolver breaks them by array position, so paint
   * order stays deterministic either way. Without normalising, a second press would collide
   * with the neighbour's index and appear to do nothing.
   */
  it('keeps values distinct, so pressing forward twice moves twice', () => {
    const draft = lessonWith([element({ zIndex: 0 }), element({ zIndex: 1 }), element({ zIndex: 2 })])
    const first = draft.slides[0]!.elements[0]!.id
    let current = draft

    for (let i = 0; i < 2; i += 1) {
      const result = applyEdit(current, { kind: 'reorder', ids: [first], direction: 'forward' }, ctx())
      if (!result.ok) throw new Error('expected success')
      current = result.draft
    }

    const z = zOf(current)
    expect(new Set(z).size).toBe(z.length)
    expect(current.slides[0]!.elements[0]!.zIndex).toBe(2)
  })

  it('resolves a tie deterministically, by array position', () => {
    const draft = lessonWith(tied())
    const order = resolve(draft.slides[0]!, 0).elements.map((e) => e.id)
    // Same input, same answer — twice, because "deterministic" is the claim.
    expect(resolve(draft.slides[0]!, 0).elements.map((e) => e.id)).toEqual(order)
    expect(order).toEqual(draft.slides[0]!.elements.map((e) => e.id))
  })

  it('reorders a locked element — locking guards transforms, not layer order (BR-011)', () => {
    const draft = lessonWith([element({ zIndex: 0, locked: true }), element({ zIndex: 1 })])
    const locked = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(draft, { kind: 'reorder', ids: [locked], direction: 'forward' }, ctx())

    expect(result.ok).toBe(true)
  })

  it('reports a missing element rather than silently doing nothing', () => {
    const draft = lessonWith([element()])
    const result = applyEdit(draft, { kind: 'reorder', ids: ['ghost'], direction: 'forward' }, ctx())

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not-found')
  })

  it('leaves geometry and timing untouched', () => {
    const draft = lessonWith([element({ x: 10, startMs: 100, endMs: 900 }), element()])
    const first = draft.slides[0]!.elements[0]!.id
    const result = applyEdit(draft, { kind: 'reorder', ids: [first], direction: 'forward' }, ctx())

    if (!result.ok) throw new Error('expected success')
    expect(result.draft.slides[0]!.elements[0]).toMatchObject({ x: 10, startMs: 100, endMs: 900 })
  })
})
