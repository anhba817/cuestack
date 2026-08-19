import { describe, expect, it } from 'vitest'
import { runKeyOf, COLLAPSIBLE_KINDS } from '../../src/history/runKey.js'
import { EDIT_KINDS, type Edit } from '../../src/draft/edit.js'

/**
 * What may join the step above it, and what may never.
 *
 * The allow-list is four kinds because those are the four a teacher genuinely repeats. The
 * timeline is the reason it matters more than it sounds: `timeline/Track.tsx` calls
 * `onRetime` from `onPointerMove`, so a two-second drag is roughly 120 applied changes, where
 * `canvas/gesture.ts` deliberately commits once on release. Without collapsing, one drag
 * exhausts a 50-step history.
 *
 * **The path is in the key, and leaving it out was a defect caught in review.** `set-field`
 * addresses an *element*, not a field, so a key of kind-plus-target would put an element's
 * width and its label in one run — and `inspector/Field.tsx` commits on every `onChange`, so
 * that is the ordinary case rather than a corner.
 */
describe('which kinds may collapse', () => {
  it('names exactly the four repeatable kinds', () => {
    expect([...COLLAPSIBLE_KINDS].sort()).toEqual(
      ['set-effect', 'set-field', 'set-slide-field', 'set-timing', 'transform-elements'].sort(),
    )
  })

  it('every other kind gets a key that cannot match itself', () => {
    // The guarantee stated as a property rather than a list, so a nineteenth kind added later
    // is non-collapsible by default rather than by whoever remembers.
    const others = EDIT_KINDS.filter((k) => !COLLAPSIBLE_KINDS.has(k))
    expect(others.length).toBeGreaterThan(10)
    for (const kind of others) {
      const edit = { kind, ids: ['a'], id: 'a' } as unknown as Edit
      expect(runKeyOf(edit)).not.toBe(runKeyOf(edit))
    }
  })
})

describe('run keys distinguish what a teacher would call separate actions', () => {
  const move = (ids: string[]): Edit => ({ kind: 'transform-elements', ids, geometry: { x: 1 } })

  it('matches for the same kind on the same elements', () => {
    expect(runKeyOf(move(['a']))).toBe(runKeyOf(move(['a'])))
  })

  it('differs when the elements differ', () => {
    expect(runKeyOf(move(['a']))).not.toBe(runKeyOf(move(['b'])))
  })

  it('ignores the order the elements were named in', () => {
    // A multi-select drag and the same drag with the selection built in another order are one
    // action to the teacher, and the key should not care which way the array came out.
    expect(runKeyOf(move(['a', 'b']))).toBe(runKeyOf(move(['b', 'a'])))
  })

  it('differs when the written path differs, on the same element', () => {
    const field = (path: string[]): Edit => ({ kind: 'set-field', id: 'a', path, value: 1 })
    expect(runKeyOf(field(['width']))).not.toBe(runKeyOf(field(['accessibility', 'label'])))
    expect(runKeyOf(field(['width']))).toBe(runKeyOf(field(['width'])))
  })

  it('differs per slide-field path, which names no element at all', () => {
    const slide = (path: string[]): Edit => ({ kind: 'set-slide-field', path, value: 1 })
    expect(runKeyOf(slide(['durationMs']))).not.toBe(runKeyOf(slide(['name'])))
    expect(runKeyOf(slide(['durationMs']))).toBe(runKeyOf(slide(['durationMs'])))
  })

  it('keeps a timing drag on one element as one run', () => {
    const retime = (ms: number): Edit => ({ kind: 'set-timing', id: 'a', startMs: ms, endMs: ms + 100 })
    expect(runKeyOf(retime(0))).toBe(runKeyOf(retime(500)))
  })

  it('separates timing runs on different elements', () => {
    const retime = (id: string): Edit => ({ kind: 'set-timing', id, startMs: 0, endMs: 100 })
    expect(runKeyOf(retime('a'))).not.toBe(runKeyOf(retime('b')))
  })

  it('keeps an effect parameter run on one effect as one run', () => {
    // `EffectFields` renders the same `Field` the inspector does, and it commits on every
    // `onChange` — so typing "0.35" is four applied changes and would be four undo steps
    // without this.
    const amount = (value: number): Edit => ({
      kind: 'set-effect',
      id: 'a',
      effectId: 'fx1',
      patch: { parameters: { amount: value } },
    })
    expect(runKeyOf(amount(0.3))).toBe(runKeyOf(amount(0.35)))
  })

  it('separates an effect’s duration from its parameters', () => {
    const duration: Edit = { kind: 'set-effect', id: 'a', effectId: 'fx1', patch: { durationMs: 700 } }
    const params: Edit = {
      kind: 'set-effect',
      id: 'a',
      effectId: 'fx1',
      patch: { parameters: { amount: 0.3 } },
    }
    expect(runKeyOf(duration)).not.toBe(runKeyOf(params))
  })

  it('separates two effects on the same element', () => {
    const on = (effectId: string): Edit => ({
      kind: 'set-effect',
      id: 'a',
      effectId,
      patch: { durationMs: 700 },
    })
    expect(runKeyOf(on('fx1'))).not.toBe(runKeyOf(on('fx2')))
  })

  it('never lets two different kinds share a key', () => {
    const transform: Edit = { kind: 'transform-elements', ids: ['a'], geometry: { x: 1 } }
    const timing: Edit = { kind: 'set-timing', id: 'a', startMs: 0, endMs: 1 }
    expect(runKeyOf(transform)).not.toBe(runKeyOf(timing))
  })
})
