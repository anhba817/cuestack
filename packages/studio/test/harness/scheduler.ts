import type { Scheduler } from '@cuestack/core'

/**
 * A scheduler a test drives by hand.
 *
 * Constitution II is NON-NEGOTIABLE about this: "a test MUST NOT depend on wall-clock sleeps."
 * Every delay this feature introduces — the 1.5 s idle interval, the retry backoff, the
 * checkpoint counter — runs through the `Scheduler` port precisely so a suite can advance
 * time by fiat rather than waiting for it.
 *
 * Deliberately not `vi.useFakeTimers()`. Fake timers would work here and would leave
 * `setTimeout` in the studio's source, which `no-clock-in-studio` refuses outright — and the
 * repository has driven every clock by injection since Wave 1.
 */
export interface TestScheduler extends Scheduler {
  /** Move time forward, firing everything due. */
  advance(ms: number): void
  /** How many timers are outstanding. Zero after a cancel, which is the point of asserting it. */
  pending(): number
  /** Every delay ever requested, in order. Lets a test assert a backoff sequence. */
  readonly delays: readonly number[]
}

interface Timer {
  at: number
  task: () => void
  cancelled: boolean
}

export function testScheduler(startMs = 0): TestScheduler {
  let clock = startMs
  const timers = new Set<Timer>()
  const delays: number[] = []

  return {
    delays,
    now: () => clock,
    after(delayMs, task) {
      delays.push(delayMs)
      const timer: Timer = { at: clock + delayMs, task, cancelled: false }
      timers.add(timer)
      return () => {
        timer.cancelled = true
        timers.delete(timer)
      }
    },
    advance(ms) {
      const target = clock + ms
      // A loop rather than one pass: a task may schedule another that is also due inside the
      // window — a retry backoff does exactly that — and firing only the first would make the
      // test disagree with the browser about how many attempts happened.
      for (;;) {
        const due = [...timers].filter((t) => t.at <= target).sort((a, b) => a.at - b.at)
        const next = due[0]
        if (!next) break
        timers.delete(next)
        clock = next.at
        if (!next.cancelled) next.task()
      }
      clock = target
    },
    pending: () => timers.size,
  }
}
