import { describe, expect, it } from 'vitest'
import { validate } from '@cuestack/schema/validate'
import { applyEdit } from '../../src/draft/reducer.js'
import { DEFAULT_EFFECT_DURATION_MS } from '../../src/timeline/constants.js'
import { countingIds } from '../harness/ids.js'
import { element, locked, lessonWith } from '../harness/corpus.js'

/**
 * Adding, configuring, and removing an effect.
 *
 * Eight effects have been implemented, tested, and **unreachable by a teacher** since Wave 1:
 * `Element.effects` is a field only a hand-written manifest could populate. These three edits
 * are what changes that, and they inherit the reducer's five promises rather than restating
 * them — pure, no mutation, validated result, read-only refusal, locked refusal.
 */

const ctx = () => ({ mode: 'edit' as const, nextId: countingIds() })
const effectsOf = (draft: ReturnType<typeof lessonWith>, index = 0) =>
  (draft.slides[0]!.elements[index] as unknown as { effects?: readonly Record<string, unknown>[] }).effects ?? []

describe('add-effect', () => {
  const add = (id: string, over: Record<string, unknown> = {}) =>
    ({ kind: 'add-effect' as const, id, type: 'fade', phase: 'enter' as const, startMs: 0, durationMs: DEFAULT_EFFECT_DURATION_MS, ...over })

  it('adds an effect that is immediately valid (FR-019)', () => {
    const el = element()
    const result = applyEdit(lessonWith([el]), add(el.id), ctx())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [effect] = effectsOf(result.draft)
    expect(effect).toMatchObject({ type: 'fade', phase: 'enter', startMs: 0, durationMs: 400 })
    expect(validate(result.draft).ok).toBe(true)
  })

  it('takes its id from the session’s IdSource, never from crypto directly', () => {
    // Feature 005's rule. A generated id has to be reproducible in a test, and a module
    // reaching for `crypto.randomUUID()` makes the whole draft unassertable.
    const el = element()
    const result = applyEdit(lessonWith([el]), add(el.id), ctx())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(String((effectsOf(result.draft)[0] as { id: string }).id)).toMatch(/^el-\d+$/)
  })

  it('reports the id it created, so a surface can select what it just made', () => {
    const el = element()
    const result = applyEdit(lessonWith([el]), add(el.id), ctx())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.idsCreated).toHaveLength(1)
  })

  it('sorts a new effect last among those sharing its start time (FR-022)', () => {
    const el = element()
    let draft = lessonWith([el])
    const context = ctx()
    for (let i = 0; i < 3; i += 1) {
      const result = applyEdit(draft, add(el.id, { startMs: 1000 }), context)
      expect(result.ok).toBe(true)
      if (result.ok) draft = result.draft
    }
    const orders = effectsOf(draft).map((e) => e['order'] as number)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    expect(new Set(orders).size).toBe(3)
  })

  it('refuses an unknown type rather than writing something the resolver cannot run', () => {
    const el = element()
    const result = applyEdit(lessonWith([el]), add(el.id, { type: 'sparkle' }), ctx())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
  })

  it('refuses a locked element (BR-011)', () => {
    const el = locked()
    const result = applyEdit(lessonWith([el]), add(el.id), ctx())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('locked')
  })

  it('refuses in read-only', () => {
    const el = element()
    const result = applyEdit(lessonWith([el]), add(el.id), { mode: 'read-only', nextId: countingIds() })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('read-only')
  })
})

describe('set-effect', () => {
  const withEffect = () => {
    const el = element()
    const result = applyEdit(
      lessonWith([el]),
      { kind: 'add-effect', id: el.id, type: 'pulse', phase: 'emphasis', startMs: 500, durationMs: 400 },
      ctx(),
    )
    if (!result.ok) throw new Error('setup failed')
    return { draft: result.draft, elementId: el.id, effectId: (effectsOf(result.draft)[0] as { id: string }).id }
  }

  it('changes a duration', () => {
    const { draft, elementId, effectId } = withEffect()
    const result = applyEdit(draft, { kind: 'set-effect', id: elementId, effectId, patch: { durationMs: 900 } }, ctx())
    expect(result.ok).toBe(true)
    if (result.ok) expect(effectsOf(result.draft)[0]!['durationMs']).toBe(900)
  })

  it('refuses a duration of zero **with a reason** (FR-023, BR-004)', () => {
    // `msDuration` is `positive()` because zero is not "instant" — `appear` is. The refusal
    // says so, rather than reporting a schema path a teacher cannot act on.
    const { draft, elementId, effectId } = withEffect()
    const result = applyEdit(draft, { kind: 'set-effect', id: elementId, effectId, patch: { durationMs: 0 } }, ctx())

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toMatch(/positive|longer than|appear/i)
  })

  it('refuses a negative duration too', () => {
    const { draft, elementId, effectId } = withEffect()
    const result = applyEdit(draft, { kind: 'set-effect', id: elementId, effectId, patch: { durationMs: -1 } }, ctx())
    expect(result.ok).toBe(false)
  })

  it('refuses a phase the effect does not declare', () => {
    // `pulse` declares `emphasis` alone. Offering it as an entrance would produce a manifest
    // the schema accepts and the resolver would run wrongly.
    const { draft, elementId, effectId } = withEffect()
    const result = applyEdit(draft, { kind: 'set-effect', id: elementId, effectId, patch: { phase: 'exit' } }, ctx())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
  })

  it('sets parameters by flat key, as the descriptor declares them', () => {
    const { draft, elementId, effectId } = withEffect()
    const result = applyEdit(
      draft,
      { kind: 'set-effect', id: elementId, effectId, patch: { parameters: { amount: 0.4 } } },
      ctx(),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(effectsOf(result.draft)[0]!['parameters']).toEqual({ amount: 0.4 })
  })

  it('does not clamp a start into the element’s window', () => {
    // An effect that runs after its element has gone is authorable — `Effect.startMs` is
    // *slide* time — and the timeline is required to say it would never run rather than to
    // prevent it. The clamp belongs to the defaults, not to the reducer.
    const { draft, elementId, effectId } = withEffect()
    const result = applyEdit(draft, { kind: 'set-effect', id: elementId, effectId, patch: { startMs: 20_000 } }, ctx())
    expect(result.ok).toBe(true)
    if (result.ok) expect(effectsOf(result.draft)[0]!['startMs']).toBe(20_000)
  })

  it('never changes the element’s own timing (FR-021)', () => {
    const { draft, elementId, effectId } = withEffect()
    const before = draft.slides[0]!.elements[0]!
    const result = applyEdit(draft, { kind: 'set-effect', id: elementId, effectId, patch: { durationMs: 2000 } }, ctx())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const after = result.draft.slides[0]!.elements[0]!
    expect(after.startMs).toBe(before.startMs)
    expect(after.endMs).toBe(before.endMs)
  })

  it('refuses an effect that is not there', () => {
    const { draft, elementId } = withEffect()
    const result = applyEdit(draft, { kind: 'set-effect', id: elementId, effectId: 'nope', patch: {} }, ctx())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not-found')
  })
})

describe('remove-effect', () => {
  it('removes the effect and leaves the element’s own timing intact (FR-021)', () => {
    const el = element({ startMs: 1000, endMs: 5000 })
    const added = applyEdit(
      lessonWith([el]),
      { kind: 'add-effect', id: el.id, type: 'fade', phase: 'enter', startMs: 1000, durationMs: 400 },
      ctx(),
    )
    expect(added.ok).toBe(true)
    if (!added.ok) return
    const effectId = (effectsOf(added.draft)[0] as { id: string }).id

    const result = applyEdit(added.draft, { kind: 'remove-effect', id: el.id, effectId }, ctx())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(effectsOf(result.draft)).toHaveLength(0)
    expect(result.draft.slides[0]!.elements[0]!.startMs).toBe(1000)
    expect(result.draft.slides[0]!.elements[0]!.endMs).toBe(5000)
    expect(validate(result.draft).ok).toBe(true)
  })

  it('refuses a locked element', () => {
    const el = locked()
    const result = applyEdit(lessonWith([el]), { kind: 'remove-effect', id: el.id, effectId: 'x' }, ctx())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('locked')
  })
})
