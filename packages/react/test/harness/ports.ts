import { memoryAdapters, type Ports } from '@cuestack/core'

export interface SyntheticClock {
  (): number
  advance(ms: number): void
}

function syntheticClock(): SyntheticClock {
  let now = 0
  const clock = (() => now) as SyntheticClock
  clock.advance = (ms) => { now += ms }
  return clock
}

export interface TestPorts extends Ports {
  clock: SyntheticClock
  setHidden(hidden: boolean): void
}

/** Ports for rendering tests: a hand-advanced clock and a controllable visibility
 *  signal, so nothing in the suite waits in real time. */
export function testPorts(): TestPorts {
  const clock = syntheticClock()
  let hidden = false
  const listeners = new Set<(h: boolean) => void>()

  return {
    clock,
    time: clock,
    // No media. A test that needs commandable media uses `harness/media.ts`, whose fake
    // records what the lesson asked for as well as what it did.
    media: {
      query: () => null,
      subscribe: () => () => undefined,
      play: () => undefined,
      pause: () => undefined,
      seek: () => undefined,
    },
    visibility: {
      isHidden: () => hidden,
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
    ...memoryAdapters(),
    setHidden(next) {
      hidden = next
      for (const l of listeners) l(next)
    },
  }
}
