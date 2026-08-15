import type { MediaPort, MediaStatus } from '../ports/media.js'
import { commanded, emptyLink, reconcile, type MediaLink } from './reconcile.js'

/**
 * The only place the transport and the media port meet.
 *
 * In `@cuestack/core` rather than in the adapter, deliberately. What a media position *means*
 * for a lesson — when a slide may advance, which of two disagreeing positions wins — is a
 * rule about lessons. Only the part that touches an `HTMLMediaElement` belongs to React, and
 * that is one file implementing this port. Put reconciliation in the adapter and a second
 * adapter reimplements it, which is two answers to "which clock is right".
 */
export interface MediaLinkController {
  /**
   * Tell the link an element exists.
   *
   * The port answers about an element you name and exposes no enumeration, so the link
   * cannot discover what is on a slide. A renderer that mounts a `<video>` registers it here;
   * without that, `pauseAll` has nothing to pause and the lesson pausing would leave its
   * media playing.
   */
  attach(elementId: string): void
  detach(elementId: string): void
  /** Ask an element to move. Records the command so its echo can be recognised. */
  seek(elementId: string, positionMs: number): void
  /** Pause every attached element — the lesson pausing takes its media with it (FR-016). */
  pauseAll(): void
  /**
   * Play every attached element, from where it stopped rather than from the beginning.
   *
   * Every element, not only those this link paused. A first version kept a learner's own
   * pause across a lesson resume, which is defensible UX and is not what FR-016 says —
   * "resuming MUST pause or resume its media" — and it had a worse consequence: at start-up
   * nothing had been paused by the lesson, so nothing ever started. A refinement with no
   * requirement behind it, breaking the requirement that exists.
   */
  resumeAll(): void
  /** What the media says about itself. Null when nothing is attached. */
  statusOf(elementId: string): MediaStatus | null
  /** Called when the *learner* moved an element, so the lesson can follow (FR-036). */
  subscribe(listener: (elementId: string, positionMs: number) => void): () => void
  dispose(): void
}

export function createMediaLink(port: MediaPort): MediaLinkController {
  const links = new Map<string, MediaLink>()
  const listeners = new Set<(elementId: string, positionMs: number) => void>()

  const linkFor = (elementId: string): MediaLink => links.get(elementId) ?? emptyLink(elementId)

  const unsubscribe = port.subscribe((elementId) => {
    const status = port.query(elementId)
    if (!status) return

    const outcome = reconcile(linkFor(elementId), status.positionMs)
    links.set(elementId, outcome.link)
    if (outcome.seekTransportTo === null) return
    for (const listener of [...listeners]) listener(elementId, outcome.seekTransportTo)
  })

  return {
    attach(elementId) {
      if (!links.has(elementId)) links.set(elementId, emptyLink(elementId))
    },

    detach(elementId) {
      links.delete(elementId)
    },

    seek(elementId, positionMs) {
      links.set(elementId, commanded(linkFor(elementId), positionMs))
      port.seek(elementId, positionMs)
    },

    pauseAll() {
      for (const elementId of attached(port, links)) {
        if (port.query(elementId)?.paused === true) continue
        port.pause(elementId)
      }
    },

    resumeAll() {
      for (const elementId of attached(port, links)) {
        if (port.query(elementId)?.paused === false) continue
        port.play(elementId)
      }
    },

    statusOf: (elementId) => port.query(elementId),

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    dispose() {
      unsubscribe()
      listeners.clear()
      links.clear()
    },
  }
}

/**
 * Which elements the link knows about.
 *
 * The port exposes no enumeration — it answers about an element you name — so the link
 * tracks the ids it has seen. That is enough: an element the lesson has never commanded or
 * heard from is one it has no reason to pause.
 */
function attached(port: MediaPort, links: Map<string, MediaLink>): readonly string[] {
  return [...links.keys()].filter((id) => port.query(id) !== null)
}
