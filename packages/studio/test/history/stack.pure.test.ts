import { describe, expect, it } from 'vitest'
import { EMPTY, MAX_DEPTH, closeRun, record, redo, undo, type HistoryStep } from '../../src/history/stack.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * The algebra, with no DOM anywhere near it.
 *
 * This file runs in the `studio-pure` project, which has no `document` at all — so a history
 * implementation that started reaching for the DOM would fail to *run* rather than quietly
 * growing a dependency. Feature 005 established that guarantee for geometry; the same
 * reasoning applies here, because the interesting part of undo is a data structure.
 */

const draft = (tag: string): LessonManifest => ({ tag } as unknown as LessonManifest)
const step = (tag: string, runKey = `k:${tag}`, slideId = 's1'): HistoryStep => ({
  before: draft(tag),
  runKey,
  slideId,
  selectionBefore: [],
})
const here = (tag: string, slideId = 's1') => ({
  before: draft(tag),
  slideId,
  selectionBefore: [] as readonly string[],
})

describe('recording a change', () => {
  it('pushes a step', () => {
    expect(record(EMPTY, step('a')).past).toHaveLength(1)
  })

  it('opens a run, so the next matching change can join it', () => {
    expect(record(EMPTY, step('a')).runOpen).toBe(true)
  })

  it('collapses a matching change into the step above rather than pushing', () => {
    let s = record(EMPTY, step('a', 'nudge'))
    s = record(s, step('b', 'nudge'))
    s = record(s, step('c', 'nudge'))
    expect(s.past).toHaveLength(1)
    // And the surviving step still points at the state the whole run started from, which is
    // what makes collapsing need no arithmetic.
    expect(s.past[0]!.before).toEqual(draft('a'))
  })

  it('does not collapse across a closed run', () => {
    let s = record(EMPTY, step('a', 'nudge'))
    s = closeRun(s)
    s = record(s, step('b', 'nudge'))
    expect(s.past).toHaveLength(2)
  })

  it('does not collapse a different run key', () => {
    let s = record(EMPTY, step('a', 'nudge'))
    s = record(s, step('b', 'resize'))
    expect(s.past).toHaveLength(2)
  })

  it('keeps at most MAX_DEPTH steps, dropping the oldest', () => {
    let s = EMPTY
    for (let i = 0; i < MAX_DEPTH + 10; i++) s = record(s, step(`n${i}`, `k${i}`))
    expect(s.past).toHaveLength(MAX_DEPTH)
    expect(s.past[0]!.before).toEqual(draft(`n10`))
  })
})

describe('undo and redo', () => {
  it('returns null when there is nothing to undo', () => {
    expect(undo(EMPTY, here('now'))).toBeNull()
    expect(redo(EMPTY, here('now'))).toBeNull()
  })

  it('hands back the step to restore and shortens the past', () => {
    const s = record(EMPTY, step('a'))
    const result = undo(s, here('now'))!
    expect(result.step.before).toEqual(draft('a'))
    expect(result.stack.past).toHaveLength(0)
  })

  it('puts the current state on the future so redo can return to it', () => {
    const s = record(EMPTY, step('a'))
    const undone = undo(s, here('now'))!
    expect(undone.stack.future).toHaveLength(1)
    const redone = redo(undone.stack, here('a'))!
    expect(redone.step.before).toEqual(draft('now'))
  })

  it('round-trips through several steps in order', () => {
    let s = EMPTY
    s = record(s, step('a', 'k1'))
    s = record(s, step('b', 'k2'))
    const first = undo(s, here('c'))!
    expect(first.step.before).toEqual(draft('b'))
    const second = undo(first.stack, here('b'))!
    expect(second.step.before).toEqual(draft('a'))
    expect(second.stack.past).toHaveLength(0)
  })

  it('a new change discards the reversed ones (FR-003)', () => {
    const s = record(EMPTY, step('a'))
    const undone = undo(s, here('now'))!
    expect(undone.stack.future).toHaveLength(1)
    const after = record(undone.stack, step('different', 'other'))
    expect(after.future).toHaveLength(0)
  })

  it('closes the run, so the next change cannot join the step it just reversed into', () => {
    let s = record(EMPTY, step('a', 'nudge'))
    const undone = undo(s, here('now'))!
    expect(undone.stack.runOpen).toBe(false)
    s = record(undone.stack, step('b', 'nudge'))
    expect(s.past).toHaveLength(1)
  })

  it('redo respects the depth bound too', () => {
    let s = EMPTY
    for (let i = 0; i < MAX_DEPTH; i++) s = record(s, step(`n${i}`, `k${i}`))
    const undone = undo(s, here('top'))!
    const redone = redo(undone.stack, here(`n${MAX_DEPTH - 1}`))!
    expect(redone.stack.past).toHaveLength(MAX_DEPTH)
  })
})
