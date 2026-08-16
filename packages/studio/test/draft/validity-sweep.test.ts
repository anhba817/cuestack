import { describe, expect, it } from 'vitest'
import { validate } from '@cuestack/schema/validate'
import { applyEdit } from '../../src/draft/reducer.js'
import { EDIT_KINDS, type Edit } from '../../src/draft/edit.js'
import { MIN_EXTENT_UNITS } from '../../src/geometry/constants.js'
import { countingIds } from '../harness/ids.js'
import { emptySlide } from '../harness/corpus.js'

/**
 * T103 — SC-012, FR-045: no edit can produce a manifest the player would refuse.
 *
 * A generated sequence rather than a hand-written one, because the interesting failures are
 * the combinations nobody thinks to write down. Deterministic all the same: the "random" walk
 * is a fixed linear congruential sequence, so a failure is reproducible rather than a
 * once-a-fortnight red build (Constitution II).
 */

/** A tiny LCG. Seeded, so this sweep is a fixture and not a lottery. */
function walker(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000
    return state / 0x100000000
  }
}

function nextEdit(rand: () => number, ids: readonly string[]): Edit {
  const kind = EDIT_KINDS[Math.floor(rand() * EDIT_KINDS.length)]!
  const pick = () => ids[Math.floor(rand() * ids.length)] ?? 'missing'
  const some = ids.length > 0 ? [pick()] : []
  const number = () => Math.floor(rand() * 2000) - 500

  switch (kind) {
    case 'add-element':
      return { kind, type: ['text', 'shape', 'image', 'button'][Math.floor(rand() * 4)]! }
    case 'transform-elements':
      return { kind, ids: some, geometry: { x: number(), y: number(), width: number(), height: number() } }
    case 'set-field':
      return { kind, id: pick(), path: ['x'], value: number() }
    case 'set-slide-field':
      return { kind, path: ['name'], value: 'swept' }
    case 'set-text':
      return { kind, id: pick(), text: `text ${Math.floor(rand() * 100)}` }
    case 'reorder':
      return { kind, ids: some, direction: rand() > 0.5 ? 'forward' : 'backward' }
    case 'set-flag':
      return { kind, ids: some, flag: rand() > 0.5 ? 'locked' : 'hidden', value: rand() > 0.5 }
    case 'duplicate':
      return { kind, ids: some }
    case 'paste':
      return { kind, elements: [] }
    case 'delete':
      return { kind, ids: some }
    case 'align':
      return { kind, ids: ids.slice(0, 2), edge: 'left' }
    case 'distribute':
      return { kind, ids: ids.slice(0, 3), axis: 'horizontal' }
  }
}

describe('a generated sequence of edits never produces an invalid lesson', () => {
  it('validates after every accepted edit, across 400 edits', () => {
    const rand = walker(20260816)
    const nextId = countingIds()
    let draft = emptySlide()
    let accepted = 0

    for (let i = 0; i < 400; i += 1) {
      const ids = draft.slides[0]!.elements.map((e) => e.id)
      const result = applyEdit(draft, nextEdit(rand, ids), { mode: 'edit', nextId })
      if (!result.ok) continue
      accepted += 1
      draft = result.draft
      // The claim, checked after every single accepted edit rather than at the end.
      expect(validate(draft).ok).toBe(true)
    }

    // A sweep that refused everything would pass the assertion above and prove nothing.
    expect(accepted).toBeGreaterThan(50)
  })

  it('is reproducible — the same seed walks the same path', () => {
    // One starting manifest: `emptySlide()` mints a fresh lesson id per call, which would make
    // the two runs differ for a reason that has nothing to do with the walk.
    const start = emptySlide()
    const run = (): string => {
      const rand = walker(7)
      const nextId = countingIds()
      let draft = start
      for (let i = 0; i < 60; i += 1) {
        const ids = draft.slides[0]!.elements.map((e) => e.id)
        const result = applyEdit(draft, nextEdit(rand, ids), { mode: 'edit', nextId })
        if (result.ok) draft = result.draft
      }
      return JSON.stringify(draft)
    }
    expect(run()).toBe(run())
  })

  /**
   * The negative control from quickstart §3.
   *
   * A validity gate that cannot fail is the theme-gate mistake from feature 003 repeated —
   * green for three tasks while enforcing nothing. Rather than editing source to prove it,
   * this asserts the clamp that keeps the sweep green is actually load-bearing: without it, a
   * negative width reaches the schema and is refused.
   */
  it('would go red without the extent clamp — the clamp is what keeps it green', () => {
    const draft = emptySlide()
    const nextId = countingIds()
    const added = applyEdit(draft, { kind: 'add-element', type: 'text' }, { mode: 'edit', nextId })
    if (!added.ok) throw new Error('expected success')
    const id = added.draft.slides[0]!.elements[0]!.id

    // Through the transform path, which clamps: accepted, and valid.
    const clamped = applyEdit(
      added.draft,
      { kind: 'transform-elements', ids: [id], geometry: { width: -999 } },
      { mode: 'edit', nextId },
    )
    expect(clamped.ok).toBe(true)
    if (clamped.ok) {
      expect(clamped.draft.slides[0]!.elements[0]!.width).toBe(MIN_EXTENT_UNITS)
      expect(validate(clamped.draft).ok).toBe(true)
    }

    // Through a raw field write, which does not clamp: refused by validation, exactly as the
    // sweep would be if the clamp were removed.
    const raw = applyEdit(
      added.draft,
      { kind: 'set-field', id, path: ['width'], value: -999 },
      { mode: 'edit', nextId },
    )
    expect(raw.ok).toBe(false)
    if (!raw.ok) expect(raw.reason).toBe('invalid')
  })
})
