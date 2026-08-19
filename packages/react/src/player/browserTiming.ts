import type { Connectivity, Scheduler } from '@cuestack/core'

/**
 * The browser's timer and its network signal, behind the ports the editor takes.
 *
 * **Client-only, and factories rather than constants**, for the same reason `browserPorts` is:
 * constructing one during a server render would touch a browser global on the server path.
 *
 * They live here rather than in `@cuestack/studio` because `no-clock-in-studio` forbids
 * `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date`, and `performance.now` anywhere
 * under `packages/studio/src` — with no `ignores`, deliberately. That rule's own comment names
 * this route: "both primitives the editor needs already live in `@cuestack/react` ... so
 * `usePlayback` imports rather than reimplements." Autosave's three delays take the same road
 * (research R-03).
 */
export function browserScheduler(): Scheduler {
  return {
    // performance.now, not Date.now: monotonic, so a system clock adjustment cannot make an
    // interval appear to run backwards. Same reasoning as `browserPorts().time`.
    now: () => performance.now(),
    after(delayMs, task) {
      const handle = setTimeout(task, delayMs)
      return () => clearTimeout(handle)
    },
  }
}

/**
 * `navigator.onLine` plus its two events.
 *
 * Reports whether there is a network interface, which is **not** whether the host's API
 * answers — a captive portal is online and useless, a dead backend is online and useless. The
 * editor treats a save outcome as the authority and this only as an accelerator: it turns
 * "the connection came back" from something discovered up to two minutes later into something
 * discovered at once (research R-09).
 */
export function browserConnectivity(): Connectivity {
  return {
    isOnline: () => navigator.onLine,
    subscribe(listener) {
      const online = (): void => listener(true)
      const offline = (): void => listener(false)
      window.addEventListener('online', online)
      window.addEventListener('offline', offline)
      return () => {
        window.removeEventListener('online', online)
        window.removeEventListener('offline', offline)
      }
    },
  }
}
