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
    media: { query: () => null, subscribe: () => () => undefined },
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
