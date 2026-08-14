import type { TimeSource } from '../ports/index.js'

/**
 * The ceiling on a single tick's delta.
 *
 * A larger gap is treated as elapsed real-world time that did not happen in the
 * lesson. Machine sleep, a blocked main thread, and a paused debugger all produce
 * the same enormous delta, and none of them happened to the learner — so all three
 * are handled uniformly and the platform question of whether a given monotonic
 * source advances during sleep becomes moot rather than researched (research R-03).
 */
export const CLAMP_CEILING_MS = 250

export interface Clock {
  /** Accumulated lesson time. Never decreases while running. */
  elapsedMs(): number
  start(): void
  stop(): void
  reset(toMs?: number): void
  set(toMs: number): void
  readonly running: boolean
}

/**
 * Lesson time, accumulated from an injected source.
 *
 * The kernel never reads a clock itself: real playback passes the browser's
 * high-resolution source, tests pass a hand-advanced counter, and the tested path
 * is therefore the shipped path.
 */
export function createClock(time: TimeSource): Clock {
  let accumulated = 0
  let lastSample: number | null = null

  const drain = (): void => {
    if (lastSample === null) return
    const now = time()
    const delta = now - lastSample
    lastSample = now
    if (delta <= 0) return // a non-advancing source contributes nothing
    accumulated += delta > CLAMP_CEILING_MS ? CLAMP_CEILING_MS : delta
  }

  return {
    get running() {
      return lastSample !== null
    },
    elapsedMs() {
      drain()
      return accumulated
    },
    start() {
      if (lastSample !== null) return
      lastSample = time()
    },
    stop() {
      drain()
      lastSample = null
    },
    reset(toMs = 0) {
      accumulated = toMs
      if (lastSample !== null) lastSample = time()
    },
    set(toMs) {
      accumulated = toMs
      if (lastSample !== null) lastSample = time()
    },
  }
}
