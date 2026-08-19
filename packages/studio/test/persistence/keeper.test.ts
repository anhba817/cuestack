import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { browserKeeper, keeperFor, keyFor, memoryKeeper } from '../../src/persistence/keeper.js'

/**
 * Two kinds of keeper, and the choice between them is the privacy guarantee.
 *
 * `write` returns a result rather than `void`, and that is not defensive style: `localStorage`
 * throws `QuotaExceededError` when it is full and a page can be denied storage outright.
 * Swallowing either would lose the teacher's work while the editor said it was being kept,
 * which is worse than not keeping at all (FR-024c).
 */
/** A store that refuses every write, the way a full or forbidden one does. */
const refusing = (error: unknown) => ({
  getItem: () => null,
  setItem: () => {
    throw error
  },
  removeItem: () => {
    throw error
  },
})

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('the browser keeper', () => {
  it('round-trips and clears', () => {
    const keeper = browserKeeper()
    expect(keeper.read('k')).toBeNull()
    expect(keeper.write('k', 'value').ok).toBe(true)
    expect(keeper.read('k')).toBe('value')
    keeper.clear('k')
    expect(keeper.read('k')).toBeNull()
  })

  it('reports a refusal rather than throwing', () => {
    const keeper = browserKeeper(refusing(new DOMException('full', 'QuotaExceededError')))
    const result = keeper.write('k', 'value')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('full')
  })

  it('distinguishes being denied storage from being out of room', () => {
    const keeper = browserKeeper(refusing(new Error('denied')))
    const result = keeper.write('k', 'value')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unavailable')
  })

  it('clearing a store that refuses does not throw either', () => {
    // The work is already unreachable, which is what clearing wanted.
    expect(() => browserKeeper(refusing(new Error('denied'))).clear('k')).not.toThrow()
  })
})

describe('the memory keeper', () => {
  it('round-trips without touching the browser at all', () => {
    const keeper = memoryKeeper()
    expect(keeper.write('k', 'value').ok).toBe(true)
    expect(keeper.read('k')).toBe('value')
    expect(localStorage.getItem('k')).toBeNull()
  })
})

describe('choosing between them', () => {
  it('an identity gets the durable one', () => {
    keeperFor('teacher').write('k', 'v')
    expect(localStorage.getItem('k')).toBe('v')
  })

  it('no identity gets the one that dies with the page', () => {
    // FR-029a, delivered by construction: with nothing durable written there is nothing to
    // leak, rather than something the editor declines to offer.
    keeperFor(undefined).write('k', 'v')
    expect(localStorage.getItem('k')).toBeNull()
  })
})

describe('the key', () => {
  it('names the framework, the author, and the lesson', () => {
    expect(keyFor('teacher', 'lesson-1')).toBe('cuestack:draft:teacher:lesson-1')
  })
})
