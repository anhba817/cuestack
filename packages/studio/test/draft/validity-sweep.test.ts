import { describe, expect, it } from 'vitest'
import { validate } from '@cuestack/schema/validate'
import { applyEdit } from '../../src/draft/reducer.js'
import { EDIT_KINDS, type Edit } from '../../src/draft/edit.js'
import { MIN_EXTENT_UNITS } from '../../src/geometry/constants.js'
import { countingIds } from '../harness/ids.js'
import { element, emptySlide, lessonWith } from '../harness/corpus.js'

/**
 * T103 — SC-012, FR-045: no edit can produce a manifest the player would refuse.
 *
 * A generated sequence rather than a hand-written one, because the interesting failures are
 * the combinations nobody thinks to write down. Deterministic all the same: the "random" walk
 * is a fixed linear congruential sequence, so a failure is reproducible rather than a
 * once-a-fortnight red build (Constitution II).
 */

/** Every `[elementId, effectId]` the draft currently holds. */
function effectPairs(draft: { slides: { elements: unknown[] }[] }): (readonly [string, string])[] {
  const pairs: (readonly [string, string])[] = []
  for (const element of draft.slides[0]!.elements) {
    const el = element as { id: string; effects?: { id: string }[] }
    for (const effect of el.effects ?? []) pairs.push([el.id, effect.id] as const)
  }
  return pairs
}

/** A tiny LCG. Seeded, so this sweep is a fixture and not a lottery. */
function walker(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000
    return state / 0x100000000
  }
}

/**
 * `effects` is a list of `[elementId, effectId]` pairs the draft actually holds.
 *
 * Without it `set-effect` and `remove-effect` address ids that never exist, are refused as
 * not-found every time, and the sweep silently stops covering two of the six new kinds —
 * which is what the coverage assertion at the foot of this file caught.
 */
/** A valid lesson to restore, built once so the seeded walk stays reproducible. */
const REPLACEMENT = lessonWith([element()])

function nextEdit(
  rand: () => number,
  ids: readonly string[],
  effects: readonly (readonly [string, string])[] = [],
): Edit {
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
    // Feature 006. The generator has to cover the union the moment the union grows, or the
    // sweep picks a kind it cannot build and stops being a sweep. The *assertions* about
    // what these six do land with their reducer cases in US2–US5; until then the reducer
    // refuses them as unsupported, and a refusal is a legitimate outcome here — which is
    // exactly why the `accepted > 50` floor at the foot of this file exists.
    case 'set-timing':
      return { kind, id: pick(), startMs: number(), endMs: number() }
    case 'add-effect':
      return {
        kind,
        id: pick(),
        type: ['fade', 'pulse', 'slide', 'zoom'][Math.floor(rand() * 4)]!,
        phase: rand() > 0.5 ? 'enter' : 'emphasis',
        startMs: number(),
        durationMs: number(),
      }
    case 'set-effect': {
      const [elementId, effectId] = effects[Math.floor(rand() * effects.length)] ?? [pick(), 'absent']
      return { kind, id: elementId, effectId, patch: { durationMs: number() } }
    }
    case 'remove-effect': {
      const [elementId, effectId] = effects[Math.floor(rand() * effects.length)] ?? [pick(), 'absent']
      return { kind, id: elementId, effectId }
    }
    case 'apply-sequence':
      return {
        kind,
        relationships: some.map((id) => ({
          eventKey: id,
          relationship: rand() > 0.5 ? { kind: 'after-previous' as const } : { kind: 'with-previous' as const },
        })),
      }
    case 'extend-slide':
      return { kind }
    /**
     * The sample for feature 008's nineteenth kind carries a **valid** manifest, deliberately.
     *
     * This file is a seeded random walk asserting that no edit yields a manifest the player
     * would refuse. Handing `replace-draft` an invalid one would make it assert the opposite
     * of its own header — the refusal case belongs in `replace-draft.pure.test.ts`, where a
     * refusal is the expected result.
     */
    case 'replace-draft':
      // One shared instance, not a fresh one per call: `lessonWith` mints a new lesson id
      // every time, which would make two runs of the same seed differ for a reason that has
      // nothing to do with the walk.
      return { kind, manifest: REPLACEMENT }
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
      const result = applyEdit(draft, nextEdit(rand, ids, effectPairs(draft)), { mode: 'edit', nextId })
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
        const result = applyEdit(draft, nextEdit(rand, ids, effectPairs(draft)), { mode: 'edit', nextId })
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

describe('the six timing kinds, asserted now that their reducer cases exist', () => {
  /**
   * The generator half of this landed with T016, because `nextEdit` picks a kind at random
   * from `EDIT_KINDS` and the sweep broke the moment the union grew. This is the assertion
   * half (T096): that each of the six *accepts* something and that what it accepts validates.
   *
   * A sweep in which every new kind was silently refused would pass the file above and prove
   * nothing about them — which is exactly what the `accepted > 50` floor guards against for
   * the original twelve.
   */
  const ctx = () => ({ mode: 'edit' as const, nextId: countingIds() })

  it('accepts at least one edit of every kind across a long walk', () => {
    const rand = walker(20260817)
    const nextId = countingIds()
    let draft = emptySlide()
    const accepted = new Set<string>()

    for (let i = 0; i < 4000; i += 1) {
      const ids = draft.slides[0]!.elements.map((e) => e.id)
      const edit = nextEdit(rand, ids, effectPairs(draft))
      const result = applyEdit(draft, edit, { mode: 'edit', nextId })
      if (!result.ok) continue
      accepted.add(edit.kind)
      draft = result.draft
      expect(validate(draft).ok).toBe(true)
    }

    for (const kind of EDIT_KINDS) {
      expect(accepted.has(kind), `${kind} was never accepted in 4000 edits`).toBe(true)
    }
  })

  it('validates after each of the six, applied deliberately', () => {
    // The generated walk proves reachability; this proves each one in isolation, so a
    // failure names the kind rather than a seed.
    let draft = emptySlide()
    const context = ctx()
    const step = (edit: Parameters<typeof applyEdit>[1]) => {
      const result = applyEdit(draft, edit, context)
      expect(result.ok, JSON.stringify(edit)).toBe(true)
      if (result.ok) {
        draft = result.draft
        expect(validate(draft).ok).toBe(true)
      }
    }

    step({ kind: 'add-element', type: 'text' })
    const id = draft.slides[0]!.elements[0]!.id
    step({ kind: 'set-timing', id, startMs: 500, endMs: 2500 })
    step({ kind: 'add-effect', id, type: 'fade', phase: 'enter', startMs: 500, durationMs: 400 })
    const effectId = (draft.slides[0]!.elements[0] as unknown as { effects: { id: string }[] }).effects[0]!.id
    step({ kind: 'set-effect', id, effectId, patch: { durationMs: 900 } })
    step({ kind: 'apply-sequence', relationships: [{ eventKey: id, relationship: { kind: 'first' } }] })
    step({ kind: 'set-timing', id, endMs: 30_000 })
    step({ kind: 'extend-slide' })
    step({ kind: 'remove-effect', id, effectId })
  })
})
