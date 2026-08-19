import { describe, expect, it } from 'vitest'
import {
  BACKOFF_MS,
  CHECKPOINT_INTERVAL_MS,
  IDLE_MS,
  MAX_ATTEMPTS,
  backoffFor,
  isCheckpoint,
} from '../../src/persistence/schedule.js'

/**
 * The policy, as a table.
 *
 * Pure and DOM-free on purpose: the four checkpoint triggers and the backoff sequence are
 * exactly the kind of thing that is easy to get subtly wrong and expensive to debug through a
 * rendered tree — and none of it needs a clock to check, because none of it reads one.
 */
describe('the idle interval', () => {
  it('is the 1.5 seconds NFR-PERF-005 names', () => {
    expect(IDLE_MS).toBe(1500)
  })
})

describe('the retry backoff', () => {
  it('gives five attempts', () => {
    expect(MAX_ATTEMPTS).toBe(5)
    expect(BACKOFF_MS).toHaveLength(5)
  })

  it('spans roughly two minutes in total', () => {
    const total = BACKOFF_MS.reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThan(100_000)
    expect(total).toBeLessThan(150_000)
  })

  it('increases every time, so a failing backend is not hammered', () => {
    for (let i = 1; i < BACKOFF_MS.length; i++) {
      expect(BACKOFF_MS[i]!).toBeGreaterThan(BACKOFF_MS[i - 1]!)
    }
  })

  it('answers null once the attempts are spent, rather than a sixth delay', () => {
    expect(backoffFor(1)).toBe(BACKOFF_MS[0])
    expect(backoffFor(MAX_ATTEMPTS)).toBe(BACKOFF_MS[MAX_ATTEMPTS - 1])
    expect(backoffFor(MAX_ATTEMPTS + 1)).toBeNull()
  })
})

describe('when a save is a checkpoint', () => {
  const base = {
    anyRecorded: true,
    editingMsSinceCheckpoint: 0,
    requested: false,
    beforeRestore: false,
  }

  it('the first acknowledged save after a lesson opens', () => {
    expect(isCheckpoint({ ...base, anyRecorded: false })).toBe(true)
  })

  it('after a quarter hour of continued editing', () => {
    expect(isCheckpoint({ ...base, editingMsSinceCheckpoint: CHECKPOINT_INTERVAL_MS })).toBe(true)
    expect(isCheckpoint({ ...base, editingMsSinceCheckpoint: CHECKPOINT_INTERVAL_MS - 1 })).toBe(false)
  })

  it('whenever the teacher asks', () => {
    expect(isCheckpoint({ ...base, requested: true })).toBe(true)
  })

  it('before a restore replaces unsaved work', () => {
    expect(isCheckpoint({ ...base, beforeRestore: true })).toBe(true)
  })

  it('and not otherwise, which is what keeps the history readable', () => {
    // The assertion that matters most: an ordinary autosave, of which there are dozens an
    // hour, records nothing.
    expect(isCheckpoint(base)).toBe(false)
  })
})
