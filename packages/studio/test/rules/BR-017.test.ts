import { describe, expect, it } from 'vitest'
import { resolve } from '@cuestack/core'
import { applyEdit } from '../../src/draft/reducer.js'
import { overrunsOf, requiredDurationMs } from '../../src/timeline/overrun.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * **BR-017** — when a slide's duration is reduced below an existing element or effect end,
 * the authored values are left intact and the overrun is reported. Nothing is clamped.
 *
 * Unenforceable since Wave 0, and deliberately left that way by feature 005: it recorded that
 * the editor must not silently clamp and that the warning belonged to validation. A timeline
 * is the first surface that can *show* an overrun rather than describe one, so this is the
 * feature where the rule finally has somewhere to live.
 *
 * The reason clamping is the wrong answer is worth stating: a teacher who shortens a slide
 * has said something about the slide, not about the twelve elements on it. Silently trimming
 * them would discard authored work to satisfy a number the teacher can equally well change
 * back — and they would discover it from a learner, which is too late.
 */

const ctx = () => ({ mode: 'edit' as const, nextId: countingIds() })

describe('BR-017: a shortened slide clamps nothing and reports the overrun', () => {
  it('leaves every element exactly as authored', () => {
    const el = element({ startMs: 1000, endMs: 6000 })
    const draft = lessonWith([el], { durationMs: 8000 })

    const result = applyEdit(draft, { kind: 'set-slide-field', path: ['durationMs'], value: 3000 }, ctx())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const after = result.draft.slides[0]!.elements[0]!
    expect(after.startMs).toBe(1000)
    expect(after.endMs).toBe(6000)
  })

  it('leaves an effect as authored too', () => {
    const el = element({
      startMs: 0,
      endMs: 2000,
      effects: [{ id: 'fx-1', type: 'fade', phase: 'exit', startMs: 1600, durationMs: 400, order: 0 }],
    })
    const draft = lessonWith([el], { durationMs: 8000 })

    const result = applyEdit(draft, { kind: 'set-slide-field', path: ['durationMs'], value: 1000 }, ctx())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const effect = (result.draft.slides[0]!.elements[0] as unknown as { effects: { startMs: number; durationMs: number }[] })
      .effects[0]!
    expect(effect.startMs).toBe(1600)
    expect(effect.durationMs).toBe(400)
  })

  it('reports the overrun the reduction created, naming what overruns', () => {
    const el = element({ startMs: 0, endMs: 6000 })
    const draft = lessonWith([el], { durationMs: 8000 })
    expect(overrunsOf(resolve(draft.slides[0]!, 0))).toEqual([])

    const result = applyEdit(draft, { kind: 'set-slide-field', path: ['durationMs'], value: 3000 }, ctx())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const problems = overrunsOf(resolve(result.draft.slides[0]!, 0))
    expect(problems).toHaveLength(1)
    expect(problems[0]!.elementId).toBe(el.id)
    expect(problems[0]!.message).toMatch(/not clipped|extend the slide|trim/i)
  })

  it('offers a way back, computed rather than guessed', () => {
    const el = element({ startMs: 0, endMs: 6000 })
    const draft = lessonWith([el], { durationMs: 8000 })
    const shortened = applyEdit(draft, { kind: 'set-slide-field', path: ['durationMs'], value: 3000 }, ctx())
    expect(shortened.ok).toBe(true)
    if (!shortened.ok) return

    expect(requiredDurationMs(shortened.draft.slides[0]!)).toBe(6000)

    const extended = applyEdit(shortened.draft, { kind: 'extend-slide' }, ctx())
    expect(extended.ok).toBe(true)
    if (!extended.ok) return
    expect(extended.draft.slides[0]!.durationMs).toBe(6000)
    expect(overrunsOf(resolve(extended.draft.slides[0]!, 0))).toEqual([])
  })

  it('is the kernel’s judgement, not the editor’s', () => {
    // `collectProblems` has emitted this since Wave 1 and nothing had ever read it. The
    // editor consumes; it does not detect. Two implementations of one rule would let the
    // editor and the validator disagree about whether a lesson has a problem.
    const el = element({ startMs: 0, endMs: 9000 })
    const state = resolve(lessonWith([el], { durationMs: 4000 }).slides[0]!, 0)
    for (const problem of overrunsOf(state)) {
      expect(state.problems).toContain(problem)
    }
  })
})
