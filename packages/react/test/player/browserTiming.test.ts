import { describe, expect, it, vi } from 'vitest'
import { browserScheduler, browserConnectivity } from '../../src/player/browserTiming.js'

/**
 * The two places this feature reads a browser global, and the only ones.
 *
 * The editor may not construct either — `no-clock-in-studio` bans `setTimeout` and friends
 * across `packages/studio/src/**` with no exemptions — so these ship from here and the studio
 * imports them, exactly as `usePlayback` already imports `useFrameLoop` and `browserPorts`
 * rather than reimplementing them (research R-03).
 *
 * These tests use fake timers because there is nothing left to inject: this **is** the
 * implementation that calls `setTimeout`. Everything above it in the stack drives a
 * hand-advanced double instead, which is the whole point of the port existing.
 */
describe('browserScheduler', () => {
  it('runs the task after the delay, once', () => {
    vi.useFakeTimers()
    try {
      const task = vi.fn()
      browserScheduler().after(1500, task)
      vi.advanceTimersByTime(1499)
      expect(task).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(task).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(5000)
      expect(task).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('the returned function cancels a task that has not run', () => {
    vi.useFakeTimers()
    try {
      const task = vi.fn()
      const cancel = browserScheduler().after(1000, task)
      cancel()
      vi.advanceTimersByTime(5000)
      expect(task).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancelling after the task ran is a no-op rather than an error', () => {
    // An editor unmounting mid-interval should not have to know whether the timer fired
    // first, so the contract makes the harmless case harmless.
    vi.useFakeTimers()
    try {
      const cancel = browserScheduler().after(10, () => undefined)
      vi.advanceTimersByTime(50)
      expect(() => cancel()).not.toThrow()
    } finally {
      vi.useRealTimers()
    }
  })

  it('now() does not decrease', () => {
    const scheduler = browserScheduler()
    const a = scheduler.now()
    const b = scheduler.now()
    expect(b).toBeGreaterThanOrEqual(a)
  })
})

describe('browserConnectivity', () => {
  it('reports what the browser says', () => {
    expect(typeof browserConnectivity().isOnline()).toBe('boolean')
  })

  it('notifies subscribers when the browser changes its mind', () => {
    const seen: boolean[] = []
    const unsubscribe = browserConnectivity().subscribe((online) => seen.push(online))
    window.dispatchEvent(new Event('offline'))
    window.dispatchEvent(new Event('online'))
    unsubscribe()
    window.dispatchEvent(new Event('offline'))
    expect(seen).toEqual([false, true])
  })

  it('unsubscribing removes both listeners, not one', () => {
    // The bug this catches is real and quiet: registering two events and removing one leaves
    // a listener holding a reference to an unmounted editor's state.
    const seen: boolean[] = []
    const unsubscribe = browserConnectivity().subscribe((online) => seen.push(online))
    unsubscribe()
    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('offline'))
    expect(seen).toEqual([])
  })
})
