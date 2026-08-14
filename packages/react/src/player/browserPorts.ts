import { memoryAdapters, type Ports } from '@cuestack/core'

/**
 * The ports a real browser provides.
 *
 * **Client-only, and never imported by the server entry.** Everything here reads a browser
 * global, which is why it is a factory rather than a module-level constant: constructing it
 * during a server render would be a `document` access on the server path.
 *
 * This exists because the player did not play without it. `ports` was an optional prop with
 * no default, and the effect that creates the transport returned early when it was absent —
 * so a host writing `<LessonPlayer lesson={lesson} autoPlay />` got a correct static first
 * frame and nothing else, permanently. Every test that exercised playback passed `ports`, so
 * the one path a real host takes was the one path untested.
 *
 * Storage, assets, and analytics come from the in-memory adapters. They are the honest
 * default for this wave: nothing persists yet, and a host that wants persistence supplies
 * its own ports.
 */
export function browserPorts(): Ports {
  return {
    // performance.now, not Date.now: monotonic, so a system clock adjustment mid-lesson
    // cannot move time backwards. The kernel's own delta clamp handles the rest.
    time: () => performance.now(),

    // Read-only in this wave. Driving media position from lesson time is Wave 3, which is
    // when this becomes bidirectional.
    media: { query: () => null, subscribe: () => () => undefined },

    visibility: {
      isHidden: () => document.visibilityState === 'hidden',
      subscribe(listener) {
        const handler = (): void => listener(document.visibilityState === 'hidden')
        document.addEventListener('visibilitychange', handler)
        return () => document.removeEventListener('visibilitychange', handler)
      },
    },

    ...memoryAdapters(),
  }
}
