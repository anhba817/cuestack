import { describe, expect, it } from 'vitest'
import { intentFor } from '../../src/canvas/shortcuts.js'
import { NUDGE_UNITS, NUDGE_UNITS_COARSE } from '../../src/geometry/constants.js'

/**
 * T092, T098 — what a keystroke means, checked as a table with no DOM.
 *
 * `.pure.test.ts`, so this runs in the node project. The whole shortcut surface is decidable
 * without dispatching synthetic events at a component, and keeping it that way is what makes
 * the suppression rule below testable exhaustively rather than by sampling.
 */
describe('nudging', () => {
  it('moves one logical unit per arrow press', () => {
    expect(intentFor({ key: 'ArrowRight' })).toEqual({ kind: 'nudge', dx: NUDGE_UNITS, dy: 0 })
    expect(intentFor({ key: 'ArrowUp' })).toEqual({ kind: 'nudge', dx: 0, dy: -NUDGE_UNITS })
  })

  it('coarsens with shift', () => {
    expect(intentFor({ key: 'ArrowLeft', shiftKey: true })).toEqual({
      kind: 'nudge',
      dx: -NUDGE_UNITS_COARSE,
      dy: 0,
    })
  })

  it('is expressed in logical units, so no scale is involved', () => {
    const intent = intentFor({ key: 'ArrowRight' })
    expect(intent).toMatchObject({ kind: 'nudge' })
    // 1 and 10, the manifest's own units — not pixels that look like them at some zoom.
    expect(NUDGE_UNITS).toBe(1)
    expect(NUDGE_UNITS_COARSE).toBe(10)
  })
})

describe('the shortcut map', () => {
  it.each([
    ['c', 'copy'],
    ['v', 'paste'],
    ['d', 'duplicate'],
    ['a', 'select-all'],
  ])('maps modifier+%s to %s', (key, kind) => {
    expect(intentFor({ key, modifier: true })).toEqual({ kind })
  })

  it('maps modifier+bracket to layer order', () => {
    expect(intentFor({ key: ']', modifier: true })).toEqual({ kind: 'reorder', direction: 'forward' })
    expect(intentFor({ key: '[', modifier: true })).toEqual({ kind: 'reorder', direction: 'backward' })
  })

  it('deletes on both Delete and Backspace', () => {
    expect(intentFor({ key: 'Delete' })).toEqual({ kind: 'delete' })
    expect(intentFor({ key: 'Backspace' })).toEqual({ kind: 'delete' })
  })

  it('clears the selection on Escape and enters text edit on Enter', () => {
    expect(intentFor({ key: 'Escape' })).toEqual({ kind: 'clear-selection' })
    expect(intentFor({ key: 'Enter' })).toEqual({ kind: 'edit-text' })
  })

  it('traverses on Tab, backwards with shift', () => {
    expect(intentFor({ key: 'Tab' })).toEqual({ kind: 'traverse', direction: 1 })
    expect(intentFor({ key: 'Tab', shiftKey: true })).toEqual({ kind: 'traverse', direction: -1 })
  })

  it('is case-insensitive on the modifier keys', () => {
    expect(intentFor({ key: 'D', modifier: true })).toEqual({ kind: 'duplicate' })
  })

  it('means nothing for an unbound key', () => {
    expect(intentFor({ key: 'q' })).toBeNull()
    expect(intentFor({ key: 'F7', modifier: true })).toBeNull()
  })

  it('does not fire a plain letter without a modifier', () => {
    // `d` alone must not duplicate: it is a character before it is a command.
    expect(intentFor({ key: 'd' })).toBeNull()
  })
})

/**
 * FR-016 — the rule that is obvious once broken.
 *
 * A teacher typing "add" into a heading would otherwise duplicate the element twice and then
 * delete it. Checked across the whole surface rather than by sampling, because a shortcut that
 * escaped the suppression would be found by a teacher losing work.
 */
describe('every shortcut is suppressed while text is being edited', () => {
  const chords = [
    { key: 'ArrowRight' },
    { key: 'ArrowLeft', shiftKey: true },
    { key: 'c', modifier: true },
    { key: 'v', modifier: true },
    { key: 'd', modifier: true },
    { key: 'a', modifier: true },
    { key: ']', modifier: true },
    { key: 'Delete' },
    { key: 'Backspace' },
    { key: 'Escape' },
    { key: 'Enter' },
    { key: 'Tab' },
  ]

  it.each(chords)('suppresses %o', (chord) => {
    expect(intentFor({ ...chord, textEditing: true })).toBeNull()
  })

  it('suppresses the one that started it — typing “d” inserts a d', () => {
    expect(intentFor({ key: 'd', modifier: true, textEditing: true })).toBeNull()
    expect(intentFor({ key: 'd', textEditing: true })).toBeNull()
  })
})
