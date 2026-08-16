import { describe, expect, it } from 'vitest'
import { applyEdit } from '../../src/draft/reducer.js'
import { randomIds } from '../../src/draft/ids.js'
import type { Edit } from '../../src/draft/edit.js'
import { countingIds } from '../harness/ids.js'
import { emptySlide } from '../harness/corpus.js'

/**
 * T102 — SC-016: the same edits, twice, byte for byte.
 *
 * This is what the injectable id source exists for (FR-050, research R-08). Wave 1 made the
 * clock injectable for the same reason: a test that cannot predict its own output cannot
 * assert on it, and every round-trip fixture in this repository rests on that.
 *
 * The experiment at the end is the load-bearing one. Swapping in the real random source must
 * make this fail — otherwise ids are not reaching the manifest from where the test thinks, and
 * the determinism claim is about nothing.
 */
const SEQUENCE: readonly Edit[] = [
  { kind: 'add-element', type: 'text' },
  { kind: 'add-element', type: 'shape' },
  { kind: 'add-element', type: 'image' },
  { kind: 'set-field', id: 'el-1', path: ['x'], value: 250 },
  { kind: 'transform-elements', ids: ['el-2'], geometry: { x: 700, y: 300 } },
  { kind: 'set-text', id: 'el-1', text: 'Composed twice' },
  { kind: 'duplicate', ids: ['el-1'] },
  { kind: 'reorder', ids: ['el-3'], direction: 'backward' },
  { kind: 'set-flag', ids: ['el-2'], flag: 'hidden', value: true },
  { kind: 'align', ids: ['el-1', 'el-3'], edge: 'left' },
]

/**
 * One starting manifest, shared by every replay.
 *
 * `emptySlide()` mints a fresh lesson and slide id on each call, so building it inside
 * `replay` would make the runs differ for a reason that has nothing to do with the reducer.
 * Safe to share: `applyEdit` clones and never mutates its input, which `purity.test.ts`
 * asserts directly.
 */
const START = emptySlide()

function replay(nextId: () => string, sequence: readonly Edit[] = SEQUENCE): string {
  let draft = START
  for (const edit of sequence) {
    const result = applyEdit(draft, edit, { mode: 'edit', nextId })
    if (!result.ok) throw new Error(`${edit.kind} refused: ${result.reason} — ${result.message}`)
    draft = result.draft
  }
  return JSON.stringify(draft)
}

describe('an edit sequence replays byte for byte', () => {
  it('produces identical output from an identical id source', () => {
    expect(replay(countingIds())).toBe(replay(countingIds()))
  })

  it('produces a manifest, not an empty one — so the equality is not vacuous', () => {
    const once = JSON.parse(replay(countingIds())) as {
      slides: Array<{ elements: unknown[] }>
    }
    expect(once.slides[0]!.elements.length).toBe(4)
  })

  it('is a fold: the same sequence from the same start, every time', () => {
    const runs = [replay(countingIds()), replay(countingIds()), replay(countingIds())]
    expect(new Set(runs).size).toBe(1)
  })

  /**
   * The experiment that proves the injection is load-bearing.
   *
   * If this passed, ids would not be reaching the manifest from the injected source and the
   * determinism above would be measuring something else.
   */
  it('FAILS with the real random source, which is what makes the claim mean anything', () => {
    // Adds only: the fuller sequence names ids like `el-1`, which a random source never
    // produces, so it would fail by refusal rather than by divergence — proving nothing.
    const adds: readonly Edit[] = [
      { kind: 'add-element', type: 'text' },
      { kind: 'add-element', type: 'shape' },
    ]
    expect(replay(randomIds, adds)).not.toBe(replay(randomIds, adds))
    // And the same sequence with the injected source is stable, so the difference is the
    // source and nothing else.
    expect(replay(countingIds(), adds)).toBe(replay(countingIds(), adds))
  })

  it('consumes ids only where elements are created', () => {
    // Three adds and one duplicate: four ids, no more. An edit that quietly minted one would
    // shift every subsequent id and break the replay.
    let draft = START
    const created: string[] = []
    // One source across the whole sequence — a fresh counter per edit would re-mint `el-1`
    // and the reducer would refuse the duplicate, correctly.
    const nextId = countingIds()
    for (const edit of SEQUENCE) {
      const result = applyEdit(draft, edit, { mode: 'edit', nextId })
      if (!result.ok) throw new Error(`${edit.kind} refused: ${result.reason}`)
      created.push(...result.idsCreated)
      draft = result.draft
    }
    expect(created).toHaveLength(4)
  })
})
