/**
 * A hand-advanced time source.
 *
 * Deliberately not Vitest's fake timers: a test whose subject is "does our clock
 * behave correctly" should not be mediated by another timer implementation whose
 * semantics it would then also be asserting (research R-03).
 */
export interface SyntheticClock {
  (): number
  advance(ms: number): void
  set(ms: number): void
}

export function createSyntheticClock(start = 0): SyntheticClock {
  let now = start
  const clock = (() => now) as SyntheticClock
  clock.advance = (ms) => {
    now += ms
  }
  clock.set = (ms) => {
    now = ms
  }
  return clock
}
