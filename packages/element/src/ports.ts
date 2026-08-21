import type { Ports } from '@cuestack/core'

/**
 * The ports a real browser provides.
 *
 * **A factory rather than a constant**, for the reason `@cuestack/react`'s `browserPorts.ts` gives:
 * everything here reads a browser global, and constructing it at module scope would touch `document`
 * on a server — which this package must survive, since its class is resolved at load time precisely
 * so a host's shared module graph builds.
 *
 * **This file exists because the defaults were wrong and nothing could see it.** They were an inline
 * object literal inside `#start`, and the visibility half read
 * `subscribe: () => () => undefined` — inert. The kernel implements pause-on-hidden
 * (`pausedByVisibility` in its transport) and nothing ever triggered it, so a learner who switched
 * tabs came back to a lesson that had run on without them. The React player pauses.
 *
 * It survived because **every test in this package injects `ports`** so lesson time can be driven by
 * hand, which Constitution II requires — leaving the one path a real host takes as the one path
 * untested. That sentence is almost verbatim from `browserPorts.ts`, which recorded the identical
 * lesson when the React player hit it. It did not carry across, because it lived in a comment in
 * another package. Extracting this makes the default testable, which is the part that carries.
 */
export function browserPorts(): Pick<Ports, 'time' | 'visibility'> {
  return {
    // `performance.now`, not `Date.now`: monotonic, so a system clock adjustment mid-lesson cannot
    // move a learner backwards. The kernel's own delta clamp handles the rest.
    time: () => performance.now(),

    visibility: {
      isHidden: () => document.visibilityState === 'hidden',
      subscribe(listener) {
        const handler = (): void => listener(document.visibilityState === 'hidden')
        document.addEventListener('visibilitychange', handler)
        return () => document.removeEventListener('visibilitychange', handler)
      },
    },
  }
}
