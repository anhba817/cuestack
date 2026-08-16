import { describe, expect, it } from 'vitest'
import { applyEdit } from '../../src/draft/reducer.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * T012 — the reducer's first two promises (contracts/edit-contract.md).
 *
 * Purity and immutability are asserted here rather than assumed, because every later
 * guarantee rests on them: SC-016's replay determinism, the read-only refusal, and the
 * post-edit validation all mean nothing if `applyEdit` can reach outside its arguments or
 * mutate the draft it was handed.
 */
describe('applyEdit — purity and immutability', () => {
  const ctx = () => ({ mode: 'edit' as const, nextId: countingIds() })

  it('does not mutate the draft it is given', () => {
    const before = lessonWith([element({ x: 10, y: 20 })])
    const snapshot = JSON.stringify(before)

    const result = applyEdit(
      before,
      { kind: 'transform-elements', ids: [before.slides[0]!.elements[0]!.id], geometry: { x: 99, y: 99 } },
      ctx(),
    )

    expect(result.ok).toBe(true)
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('returns no draft at all when it refuses, so no caller can hold a half-applied one', () => {
    const draft = lessonWith([element()])
    const result = applyEdit(draft, { kind: 'delete', ids: ['nope'] }, ctx())

    expect(result.ok).toBe(false)
    expect(result).not.toHaveProperty('draft')
  })

  it('produces identical output from identical input and an identical id source', () => {
    const draft = lessonWith([element()])
    const edit = { kind: 'add-element', type: 'text' } as const

    const a = applyEdit(draft, edit, { mode: 'edit', nextId: countingIds() })
    const b = applyEdit(draft, edit, { mode: 'edit', nextId: countingIds() })

    expect(a.ok && b.ok).toBe(true)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('reads no clock and no global randomness — a fresh source restarts the sequence', () => {
    const draft = lessonWith([])
    const first = applyEdit(draft, { kind: 'add-element', type: 'text' }, { mode: 'edit', nextId: countingIds() })
    const second = applyEdit(draft, { kind: 'add-element', type: 'text' }, { mode: 'edit', nextId: countingIds() })

    expect(first.ok && second.ok).toBe(true)
    if (first.ok && second.ok) expect(first.idsCreated).toEqual(second.idsCreated)
  })
})
