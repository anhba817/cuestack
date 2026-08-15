import type { MediaPort, MediaStatus } from '@cuestack/core'

/**
 * The media port over real `HTMLMediaElement` nodes.
 *
 * The only file in the package that knows a `<video>` exists. Everything about what a media
 * position *means* — when a slide advances, which of two disagreeing clocks wins — is in
 * `@cuestack/core`, because a second adapter must reach the same answers.
 *
 * Elements are found through the frame writer's node registry rather than by any renderer
 * holding a ref: video and audio render on the server path, and a React Server Component may
 * not carry one.
 */

export interface DomMediaPortOptions {
  /** The element frame for an id, as registered by the frame writer. */
  readonly nodeFor: (elementId: string) => HTMLElement | null
}

const seconds = (ms: number): number => ms / 1000
const millis = (s: number): number => Math.round(s * 1000)

function mediaNode(root: HTMLElement | null): HTMLMediaElement | null {
  if (!root) return null
  return root.querySelector('video, audio')
}

export function createDomMediaPort({ nodeFor }: DomMediaPortOptions): MediaPort {
  const listeners = new Set<(elementId: string) => void>()
  /** Elements we have wired, so listeners are attached once and removed once. */
  const wired = new Map<string, () => void>()

  const notify = (elementId: string): void => {
    for (const listener of [...listeners]) listener(elementId)
  }

  /**
   * Report position changes from **every** source, including the element's own native
   * controls. An adapter reporting only lesson-initiated changes reintroduces exactly the
   * desynchronisation this feature exists to fix, and does so invisibly.
   */
  const wire = (elementId: string, node: HTMLMediaElement): void => {
    if (wired.has(elementId)) return
    const handler = (): void => notify(elementId)
    const events = ['timeupdate', 'seeked', 'ended', 'pause', 'play', 'error', 'loadedmetadata']
    for (const name of events) node.addEventListener(name, handler)
    wired.set(elementId, () => {
      for (const name of events) node.removeEventListener(name, handler)
    })
  }

  const resolve = (elementId: string): HTMLMediaElement | null => {
    const node = mediaNode(nodeFor(elementId))
    if (node) wire(elementId, node)
    return node
  }

  return {
    query(elementId): MediaStatus | null {
      const node = resolve(elementId)
      if (!node) return null
      return {
        positionMs: millis(node.currentTime),
        /**
         * The file's duration, not the manifest's. A manifest figure is authoring metadata
         * and may be wrong; the learner watches the file. `NaN` before metadata arrives
         * becomes null — the absence of a duration, which a media-gated slide must be able
         * to tell apart from a duration of zero.
         */
        durationMs: Number.isFinite(node.duration) ? millis(node.duration) : null,
        ended: node.ended,
        paused: node.paused,
        /** Reported rather than never reporting, so a gated slide can reach
         *  `ADVANCE_MEDIA_FAILED` instead of waiting forever. */
        failed: node.error !== null,
      }
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          for (const unwire of wired.values()) unwire()
          wired.clear()
        }
      }
    },

    /**
     * Commands are fire-and-forget and never throw. `play()` returns a promise that rejects
     * when autoplay is blocked, which is a normal outcome rather than an error the lesson can
     * act on — the truth arrives through the next `query`, like every other fact about media.
     */
    play(elementId) {
      void resolve(elementId)?.play()?.catch(() => undefined)
    },

    pause(elementId) {
      resolve(elementId)?.pause()
    },

    seek(elementId, positionMs) {
      const node = resolve(elementId)
      if (!node) return
      node.currentTime = seconds(positionMs)
    },
  }
}
