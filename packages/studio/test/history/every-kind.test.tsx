import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { renderEditor } from '../harness/editor.js'
import { lessonWith, element } from '../harness/corpus.js'
import { questionElement } from '../harness/preview.js'
import { EDIT_KINDS, type Edit, type EditKind } from '../../src/draft/edit.js'

/**
 * Every change the editor can make, taken back exactly.
 *
 * SC-001 and SC-002 together, and the test that fails when a new edit kind arrives
 * unconsidered — **the walk is driven from `EDIT_KINDS` itself**, not a hand-written list, so
 * a kind added without a sample here fails rather than passing quietly.
 *
 * The assertion is byte-identity of the manifest, not "looks right". A reversal that restored
 * geometry and dropped an effect, or restored an element without its `zIndex`, would satisfy
 * every reasonable-looking check and lose a teacher's work.
 */

const lesson = () =>
  lessonWith([
    // Distinct geometry, because `align` and `distribute` on three identical positions
    // succeed and change nothing — and a reversal test whose edit is a no-op asserts nothing.
    element({ id: 'a', effects: [], x: 10, y: 10 }),
    element({ id: 'b', effects: [], x: 200, y: 120 }),
    element({ id: 'c', effects: [], x: 500, y: 300 }),
    questionElement({ id: 'q' }),
  ])

/** A representative edit per kind, against the fixture above. */
function sampleFor(kind: EditKind, ctx: { effectId?: string }): Edit | null {
  switch (kind) {
    case 'add-element':
      return { kind, type: 'text' }
    case 'transform-elements':
      return { kind, ids: ['a'], geometry: { x: 400, y: 250 } }
    case 'set-field':
      return { kind, id: 'a', path: ['width'], value: 321 }
    case 'set-slide-field':
      return { kind, path: ['durationMs'], value: 9999 }
    case 'set-text':
      return { kind, id: 'a', text: 'changed' }
    case 'reorder':
      return { kind, ids: ['a'], direction: 'forward' }
    case 'set-flag':
      return { kind, ids: ['a'], flag: 'locked', value: true }
    case 'duplicate':
      return { kind, ids: ['a'] }
    case 'paste':
      return { kind, elements: [element({ id: 'pasted', effects: [] })] }
    case 'delete':
      return { kind, ids: ['b'] }
    case 'align':
      return { kind, ids: ['a', 'b'], edge: 'left' }
    case 'distribute':
      return { kind, ids: ['a', 'b', 'c'], axis: 'horizontal' }
    case 'set-timing':
      return { kind, id: 'a', startMs: 500, endMs: 1500 }
    case 'add-effect':
      return { kind, id: 'a', type: 'fade', phase: 'enter', startMs: 0, durationMs: 400 }
    case 'set-effect':
      return ctx.effectId ? { kind, id: 'a', effectId: ctx.effectId, patch: { durationMs: 700 } } : null
    case 'remove-effect':
      return ctx.effectId ? { kind, id: 'a', effectId: ctx.effectId } : null
    case 'apply-sequence':
      return { kind, relationships: [{ eventKey: 'b', relationship: { kind: 'after-previous' } }] }
    case 'extend-slide':
      return { kind }
    case 'replace-draft':
      // Feature 008's nineteenth kind, and the walk found it: this file drives from
      // `EDIT_KINDS` rather than a hand-written list precisely so a new kind fails here until
      // somebody decides what reversing it means.
      return { kind, manifest: lessonWith([element({ id: 'restored', effects: [] })]) }
    default:
      return null
  }
}

describe('every edit kind is reversible, byte for byte', () => {
  for (const kind of EDIT_KINDS) {
    it(`undoes ${kind}`, () => {
      const { handle } = renderEditor(lesson())
      const session = () => handle.session

      // `set-effect` and `remove-effect` need an effect to address, so one is added first and
      // the baseline is taken after it — the kind under test is still the only change undone.
      let effectId: string | undefined
      if (kind === 'set-effect' || kind === 'remove-effect') {
        act(() => {
          const added = session().apply({
            kind: 'add-effect',
            id: 'a',
            type: 'fade',
            phase: 'enter',
            startMs: 0,
            durationMs: 400,
          })
          if (added.ok) effectId = added.idsCreated[0]
        })
        act(() => session().endEditRun())
      }

      const edit = sampleFor(kind, { effectId })
      expect(edit, `no sample edit for "${kind}" — add one rather than skipping it`).not.toBeNull()

      const before = JSON.stringify(session().draft)
      let applied = false
      act(() => {
        applied = session().apply(edit!).ok
      })
      expect(applied, `the sample edit for "${kind}" was refused`).toBe(true)
      expect(JSON.stringify(session().draft)).not.toBe(before)

      act(() => session().undo())
      expect(JSON.stringify(session().draft)).toBe(before)
    })

    it(`redoes ${kind}`, () => {
      const { handle } = renderEditor(lesson())
      const session = () => handle.session
      let effectId: string | undefined
      if (kind === 'set-effect' || kind === 'remove-effect') {
        act(() => {
          const added = session().apply({
            kind: 'add-effect',
            id: 'a',
            type: 'fade',
            phase: 'enter',
            startMs: 0,
            durationMs: 400,
          })
          if (added.ok) effectId = added.idsCreated[0]
        })
        act(() => session().endEditRun())
      }
      const edit = sampleFor(kind, { effectId })!
      act(() => void session().apply(edit))
      const after = JSON.stringify(session().draft)

      act(() => session().undo())
      act(() => session().redo())
      expect(JSON.stringify(session().draft)).toBe(after)
    })
  }
})
