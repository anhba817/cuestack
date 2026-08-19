import { act, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NUDGE_UNITS, NUDGE_UNITS_COARSE } from '../../src/geometry/constants.js'
import { renderEditor } from '../harness/editor.js'
import { element, lessonWith, locked } from '../harness/corpus.js'

/**
 * T089–T091, T095 — SC-005: every action in US1–US3, with no pointer at all.
 *
 * Fired at the overlay rather than simulated through the shortcut map, so this checks the
 * wiring the pure suite cannot: that the handler is attached, that intents reach the session,
 * and that what results is announced.
 */
function setup(elements = [element(), element(), element()], mode: 'edit' | 'read-only' = 'edit') {
  // The hook renders inside the tree, so a state change re-renders the canvas. Passing a
  // session snapshot as a prop leaves the overlay handling keys against a stale draft.
  const { handle, container } = renderEditor(lessonWith(elements), { mode })
  const press = (key: string, opts: Record<string, boolean> = {}) =>
    act(() => void fireEvent.keyDown(container.querySelector('[data-cs-overlay]')!, { key, ...opts }))
  const announcement = () => container.querySelector('[data-cs-announcer]')!.textContent
  return { result: handle, container, press, announcement }
}

const ids = (r: { session: { draft: { slides: Array<{ elements: Array<{ id: string }> }> } } }) =>
  r.session.draft.slides[0]!.elements.map((e) => e.id)

describe('traversal (FR-034, FR-041)', () => {
  it('moves the selection between elements in paint order', () => {
    const { result, press } = setup()
    press('Tab')
    expect(result.session.selection).toEqual([ids(result)[0]])
    press('Tab')
    expect(result.session.selection).toEqual([ids(result)[1]])
  })

  it('goes backwards with shift', () => {
    const { result, press } = setup()
    press('Tab') // → 0
    press('Tab') // → 1
    press('Tab') // → 2
    press('Tab', { shiftKey: true }) // → 1
    expect(result.session.selection).toEqual([ids(result)[1]])
  })

  it('wraps rather than dead-ending at the last element', () => {
    const { result, press } = setup()
    for (let i = 0; i < 4; i += 1) press('Tab')
    expect(result.session.selection).toEqual([ids(result)[0]])
  })

  it('announces what is now selected, with a subject', () => {
    const { press, announcement } = setup()
    press('Tab')
    expect(announcement()).toContain('selected')
    expect(announcement()).toContain('text')
  })
})

describe('nudging (FR-035)', () => {
  it('moves one logical unit', () => {
    const { result, press } = setup([element({ x: 100, y: 100 })])
    act(() => result.session.select([ids(result)[0]!]))
    press('ArrowRight')
    expect(result.session.draft.slides[0]!.elements[0]!.x).toBe(100 + NUDGE_UNITS)
  })

  it('moves ten with a modifier', () => {
    const { result, press } = setup([element({ x: 100, y: 100 })])
    act(() => result.session.select([ids(result)[0]!]))
    press('ArrowDown', { shiftKey: true })
    expect(result.session.draft.slides[0]!.elements[0]!.y).toBe(100 + NUDGE_UNITS_COARSE)
  })

  it('moves a whole selection, keeping spacing', () => {
    const { result, press } = setup([element({ x: 0 }), element({ x: 300 })])
    act(() => result.session.select(ids(result)))
    press('ArrowRight', { shiftKey: true })
    const xs = result.session.draft.slides[0]!.elements.map((e) => e.x)
    expect(xs).toEqual([NUDGE_UNITS_COARSE, 300 + NUDGE_UNITS_COARSE])
  })

  it('skips a locked member rather than refusing the whole nudge', () => {
    const { result, press } = setup([element({ x: 0 }), locked()])
    act(() => result.session.select(ids(result)))
    press('ArrowRight')
    expect(result.session.draft.slides[0]!.elements[0]!.x).toBe(NUDGE_UNITS)
    expect(result.session.draft.slides[0]!.elements[1]!.x).toBe(100)
  })

  it('announces what moved and where it went (FR-040)', () => {
    const { result, press, announcement } = setup([element({ x: 100, y: 100 })])
    act(() => result.session.select([ids(result)[0]!]))
    press('ArrowRight')
    expect(announcement()).toContain('moved to')
    expect(announcement()).toContain('text')
  })
})

describe('the rest of US1–US3, from the keyboard alone (SC-005)', () => {
  it('duplicates', () => {
    const { result, press } = setup([element()])
    act(() => result.session.select([ids(result)[0]!]))
    press('d', { metaKey: true })
    expect(result.session.draft.slides[0]!.elements).toHaveLength(2)
  })

  it('copies and pastes', () => {
    const { result, press } = setup([element()])
    act(() => result.session.select([ids(result)[0]!]))
    press('c', { metaKey: true })
    expect(result.session.clipboard).toHaveLength(1)
    press('v', { metaKey: true })
    expect(result.session.draft.slides[0]!.elements).toHaveLength(2)
  })

  it('selects all, and clears', () => {
    const { result, press } = setup()
    press('a', { metaKey: true })
    expect(result.session.selection).toHaveLength(3)
    press('Escape')
    expect(result.session.selection).toEqual([])
  })

  it('reorders', () => {
    const { result, press } = setup([element({ zIndex: 0 }), element({ zIndex: 1 })])
    act(() => result.session.select([ids(result)[0]!]))
    press(']', { metaKey: true })
    const [a, b] = result.session.draft.slides[0]!.elements
    expect(a!.zIndex).toBeGreaterThan(b!.zIndex)
  })

  it('deletes at once, and one undo brings it back (FR-012)', () => {
    // This asserted the confirmation the Delete key used to open. Feature 008 removed it, so
    // what the keyboard now owes is the same as the mouse: the deletion happens, it is
    // announced, and it is reversible in one action.
    const { result, container, press } = setup([element()])
    act(() => result.session.select([ids(result)[0]!]))
    const before = JSON.stringify(result.session.draft)

    press('Delete')
    expect(result.session.draft.slides[0]!.elements).toHaveLength(0)
    expect(container.querySelector('[data-cs-announcer]')?.textContent).toMatch(/undo/i)

    act(() => result.session.undo())
    expect(JSON.stringify(result.session.draft)).toBe(before)
  })

  it('enters text-edit mode on Enter', () => {
    const { result, press } = setup([element()])
    act(() => result.session.select([ids(result)[0]!]))
    press('Enter')
    expect(result.session.textEditing).toBe(ids(result)[0])
  })

  it('does not enter text-edit mode on a locked element', () => {
    const { result, press } = setup([locked()])
    act(() => result.session.select([ids(result)[0]!]))
    press('Enter')
    expect(result.session.textEditing).toBeNull()
  })
})

describe('read-only mode ignores the keyboard entirely (FR-051)', () => {
  it('changes nothing across the whole shortcut surface', () => {
    const { result, press } = setup([element()], 'read-only')
    act(() => result.session.select([ids(result)[0]!]))
    const before = JSON.stringify(result.session.draft)

    for (const key of ['ArrowRight', 'Delete', 'Enter']) press(key)
    press('d', { metaKey: true })
    press('v', { metaKey: true })

    expect(JSON.stringify(result.session.draft)).toBe(before)
  })
})
