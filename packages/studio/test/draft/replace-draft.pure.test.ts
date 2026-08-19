import { describe, expect, it } from 'vitest'
import { applyEdit } from '../../src/draft/reducer.js'
import type { Edit } from '../../src/draft/edit.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'
import type { LessonManifest } from '@cuestack/schema'

/**
 * Restoring a version is a change like any other, and that is the whole design.
 *
 * The first plan gave the session a `replaceDraft(manifest)` method. It would have bypassed
 * the read-only refusal, the schema validation, and the closure guarantee feature 005's
 * SC-017 asserts — on the **one input in this system that did not come from the editor's own
 * reducer**. A version was written by an earlier release and handed back by a host; skipping
 * validation on precisely that path is backwards (research R-12).
 *
 * It branches inside `applyEdit` rather than in `dispatch`, because the frame clones a draft
 * and `dispatch` mutates it in place — there is nothing for a whole-manifest replacement to
 * mutate. Two entry points into one frame, both passing the same refusal and the same
 * validator.
 */
const ctx = { mode: 'edit' as const, nextId: countingIds() }
const replaceWith = (manifest: LessonManifest): Edit => ({ kind: 'replace-draft', manifest })

describe('replacing the draft', () => {
  it('takes the incoming lesson wholesale', () => {
    const before = lessonWith([element({ id: 'a', effects: [] })])
    const incoming = lessonWith([element({ id: 'x', effects: [] }), element({ id: 'y', effects: [] })])

    const result = applyEdit(before, replaceWith(incoming), ctx)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.slides[0]!.elements.map((e) => e.id)).toEqual(['x', 'y'])
  })

  it('does not mutate the incoming manifest, so the caller can keep it', () => {
    const incoming = lessonWith([element({ id: 'x', effects: [] })])
    const snapshot = JSON.stringify(incoming)
    const result = applyEdit(lessonWith([element()]), replaceWith(incoming), ctx)
    expect(result.ok).toBe(true)
    expect(JSON.stringify(incoming)).toBe(snapshot)
  })

  it('creates no ids — a restore mints nothing', () => {
    const result = applyEdit(lessonWith([element()]), replaceWith(lessonWith([element()])), ctx)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.idsCreated).toEqual([])
  })
})

describe('what it refuses', () => {
  it('a lesson the current format would reject, leaving the draft untouched', () => {
    const before = lessonWith([element({ id: 'a', effects: [] })])
    const broken = { ...lessonWith([element()]), slides: [] } as unknown as LessonManifest

    const result = applyEdit(before, replaceWith(broken), ctx)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('invalid')
    expect(result.message).toMatch(/cannot be opened|not a lesson/i)
  })

  it('read-only, with the same refusal every other change receives', () => {
    const result = applyEdit(
      lessonWith([element()]),
      replaceWith(lessonWith([element()])),
      { ...ctx, mode: 'read-only' },
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('read-only')
    expect(result.message).toMatch(/copying is still permitted/i)
  })

  it('refuses read-only before it even looks at the manifest', () => {
    // The blanket refusal runs before anything else in the frame, so an invalid lesson in a
    // read-only session is refused as read-only rather than as invalid — the teacher is told
    // the thing that is actually stopping them.
    const broken = { ...lessonWith([element()]), slides: [] } as unknown as LessonManifest
    const result = applyEdit(lessonWith([element()]), replaceWith(broken), { ...ctx, mode: 'read-only' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('read-only')
  })
})

describe('it does not need a slide to exist', () => {
  it('replaces even when the context names a slide the draft has lost', () => {
    // The frame's slide lookup runs before `dispatch` and would refuse a stale `ctx.slideId`
    // — on an edit that is about to discard that slide anyway. Branching before the lookup is
    // what makes this work rather than fail with a confusing not-found.
    const result = applyEdit(
      lessonWith([element()]),
      replaceWith(lessonWith([element({ id: 'x', effects: [] })])),
      { ...ctx, slideId: 'a-slide-that-is-gone' },
    )
    expect(result.ok).toBe(true)
  })
})
