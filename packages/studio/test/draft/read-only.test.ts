import { describe, expect, it } from 'vitest'
import { applyEdit } from '../../src/draft/reducer.js'
import { EDIT_KINDS, type Edit } from '../../src/draft/edit.js'
import { countingIds } from '../harness/ids.js'
import { element, lessonWith } from '../harness/corpus.js'

/**
 * T013 — SC-017, and the file the sequencing notes single out.
 *
 * This suite enumerates the `Edit` union rather than listing the variants it happens to
 * know about. That is the whole point: a variant added in a later story fails here until
 * it is handled, instead of the guarantee silently narrowing to "the variants that existed
 * when this was written".
 *
 * Copy is deliberately absent, and its absence is asserted below. Copy writes to
 * `session.clipboard` and changes no authored data, so it never reaches the reducer — which
 * is exactly why read-only *permits* it while refusing paste (FR-051, edit-contract).
 */

/** One representative edit per kind. Kept exhaustive by the enumeration test below. */
function sampleEdit(kind: Edit['kind'], id: string): Edit {
  switch (kind) {
    case 'replace-draft':
      // Feature 008's nineteenth kind. Read-only must refuse restoring a version as firmly as
      // it refuses everything else — a lesson open for reading cannot be replaced wholesale.
      return { kind, manifest: lessonWith([element()]) }
    case 'add-element':
      return { kind, type: 'text' }
    case 'transform-elements':
      return { kind, ids: [id], geometry: { x: 5 } }
    case 'set-field':
      return { kind, id, path: ['x'], value: 42 }
    case 'set-slide-field':
      return { kind, path: ['name'], value: 'renamed' }
    case 'set-text':
      return { kind, id, text: 'changed' }
    case 'reorder':
      return { kind, ids: [id], direction: 'forward' }
    case 'set-flag':
      return { kind, ids: [id], flag: 'hidden', value: true }
    case 'duplicate':
      return { kind, ids: [id] }
    case 'paste':
      return { kind, elements: [] }
    case 'delete':
      return { kind, ids: [id] }
    case 'align':
      return { kind, ids: [id], edge: 'left' }
    case 'distribute':
      return { kind, ids: [id], axis: 'horizontal' }
    // Feature 006. Six timing kinds, enumerated here for the same reason as the twelve
    // above: the union is closed so a variant added later is refused-by-default and fails
    // a test until somebody says so deliberately.
    case 'set-timing':
      return { kind, id, startMs: 1000, endMs: 3000 }
    case 'add-effect':
      return { kind, id, type: 'fade', phase: 'enter', startMs: 0, durationMs: 400 }
    case 'set-effect':
      return { kind, id, effectId: 'fx-effect-1', patch: { durationMs: 600 } }
    case 'remove-effect':
      return { kind, id, effectId: 'fx-effect-1' }
    case 'apply-sequence':
      return { kind, relationships: [{ eventKey: id, relationship: { kind: 'after-previous' } }] }
    case 'extend-slide':
      return { kind }
  }
}

describe('read-only mode refuses every mutating edit', () => {
  const draft = lessonWith([element()])
  const targetId = draft.slides[0]!.elements[0]!.id

  it('covers every kind in the union — a new variant fails here until handled', () => {
    const covered = EDIT_KINDS.map((k) => sampleEdit(k, targetId).kind)
    expect(new Set(covered)).toEqual(new Set(EDIT_KINDS))
  })

  it.each(EDIT_KINDS)('refuses %s', (kind) => {
    const result = applyEdit(draft, sampleEdit(kind, targetId), {
      mode: 'read-only',
      nextId: countingIds(),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('read-only')
  })

  it('leaves the draft untouched across the whole union', () => {
    const snapshot = JSON.stringify(draft)
    for (const kind of EDIT_KINDS) {
      applyEdit(draft, sampleEdit(kind, targetId), { mode: 'read-only', nextId: countingIds() })
    }
    expect(JSON.stringify(draft)).toBe(snapshot)
  })

  it('does not include copy in the union, because copy is not an edit', () => {
    expect(EDIT_KINDS).not.toContain('copy')
  })
})
