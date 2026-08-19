import { describe, expect, it } from 'vitest'
import { historyIntentFor } from '../../src/history/shortcuts.js'

/**
 * The chord table, checked as a table rather than by dispatching synthetic events.
 *
 * Deliberately separate from `canvas/shortcuts.ts`: `Overlay` already listens for keydown, so
 * a shared table plus a root-level binding would undo twice on one keystroke whenever the
 * canvas had focus (research R-10).
 */
describe('history shortcuts', () => {
  it('undoes on the modifier plus Z', () => {
    expect(historyIntentFor({ key: 'z', modifier: true })).toBe('undo')
  })

  it('redoes on shift plus the modifier plus Z, the Mac convention', () => {
    expect(historyIntentFor({ key: 'z', modifier: true, shiftKey: true })).toBe('redo')
  })

  it('redoes on the modifier plus Y, the Windows convention', () => {
    expect(historyIntentFor({ key: 'y', modifier: true })).toBe('redo')
  })

  it('accepts the shifted capital the browser reports', () => {
    // A real keydown for Shift+Z reports `key: 'Z'`. Matching only lowercase would make redo
    // work on Windows and silently fail on a Mac.
    expect(historyIntentFor({ key: 'Z', modifier: true, shiftKey: true })).toBe('redo')
  })

  it('means nothing without the modifier', () => {
    expect(historyIntentFor({ key: 'z' })).toBeNull()
    expect(historyIntentFor({ key: 'y', shiftKey: true })).toBeNull()
  })

  it('means nothing for every other chord', () => {
    for (const key of ['a', 'c', 'v', 'Enter', 'Escape', 'ArrowLeft', 'Backspace']) {
      expect(historyIntentFor({ key, modifier: true })).toBeNull()
    }
  })
})
