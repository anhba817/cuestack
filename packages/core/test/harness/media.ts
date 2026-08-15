import type { MediaPort, MediaStatus } from '../../src/ports/media.js'

/**
 * A media element that does exactly what a test tells it to.
 *
 * Constitution II forbids a test depending on real media playback, and the reason is
 * sharper here than usual: a real `<video>` decides for itself when to report, whether a
 * seek lands, and how far past the requested position it settles. A suite built on that
 * is a suite that flakes, and the reconciliation rule this wave adds is precisely about
 * disagreeing clocks — so the one thing a test must control completely is the media's
 * side of the disagreement.
 *
 * Records commands as well as replaying reports. Half of what US2 must prove is what the
 * lesson *asked for*, not only what it ended up showing: "seeking the lesson commands the
 * media" is unobservable from position alone, because an echo and a real move look the
 * same afterwards.
 */

export interface MediaCommand {
  readonly kind: 'play' | 'pause' | 'seek'
  readonly elementId: string
  /** Present for `seek` only. */
  readonly positionMs?: number
}

export interface FakeMedia extends MediaPort {
  /**
   * The commands US2 adds to `MediaPort` (T048), declared here first.
   *
   * The fake implements the port it is about to become, so every US2 test can be written
   * against the final shape before the port gains it — which is what "observe the test
   * failing" requires. When T048 lands, these become redundant restatements of the port's
   * own members and can be deleted; until then they are the only place the contract exists.
   */
  play(elementId: string): void
  pause(elementId: string): void
  seek(elementId: string, positionMs: number): void

  /** Every command the lesson issued, in order. */
  readonly commands: readonly MediaCommand[]
  /** Move an element and notify subscribers, as a real element's own controls would. */
  report(elementId: string, patch: Partial<MediaStatus>): void
  /** Attach an element with a starting status. */
  attach(elementId: string, status?: Partial<MediaStatus>): void
  /** Detach, so `query` returns null again. */
  detach(elementId: string): void
  /** Stop honouring seeks — the platform refusing, which FR-035 has to survive. */
  refuseSeeks(elementId: string, refuse?: boolean): void
  clearCommands(): void
}

const IDLE: MediaStatus = {
  positionMs: 0,
  durationMs: null,
  ended: false,
  paused: true,
  failed: false,
}

export function fakeMedia(): FakeMedia {
  const elements = new Map<string, MediaStatus>()
  const refusing = new Set<string>()
  const listeners = new Set<(elementId: string) => void>()
  const commands: MediaCommand[] = []

  const notify = (elementId: string): void => {
    for (const listener of [...listeners]) listener(elementId)
  }

  const patch = (elementId: string, next: Partial<MediaStatus>): void => {
    const current = elements.get(elementId)
    if (!current) return
    elements.set(elementId, { ...current, ...next })
  }

  return {
    commands,

    attach(elementId, status = {}) {
      elements.set(elementId, { ...IDLE, ...status })
    },

    detach(elementId) {
      elements.delete(elementId)
    },

    refuseSeeks(elementId, refuse = true) {
      if (refuse) refusing.add(elementId)
      else refusing.delete(elementId)
    },

    clearCommands() {
      commands.length = 0
    },

    report(elementId, next) {
      patch(elementId, next)
      notify(elementId)
    },

    query(elementId) {
      return elements.get(elementId) ?? null
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    play(elementId) {
      commands.push({ kind: 'play', elementId })
      patch(elementId, { paused: false })
    },

    pause(elementId) {
      commands.push({ kind: 'pause', elementId })
      patch(elementId, { paused: true })
    },

    /**
     * Recorded always; honoured unless refusing.
     *
     * A refused seek reports nothing at all — which is the case FR-035 exists for, and the
     * one an `ignoreNextReport` flag would have hung on forever. Silence, not a report at
     * the old position: a browser that cannot seek does not tell you it did not.
     */
    seek(elementId, positionMs) {
      commands.push({ kind: 'seek', elementId, positionMs })
      if (refusing.has(elementId)) return
      patch(elementId, { positionMs, ended: false })
      notify(elementId)
    },
  }
}

/**
 * Degenerate scripts the edge cases need.
 *
 * Runtime behaviours of a media element, not fields of a manifest — a manifest can declare
 * `durationMs: 0`, but "the file reports zero" and "the file never ends" are things only a
 * playing element does. They live here for that reason and not in the corpus.
 */
export const degenerate = {
  /** Reports zero duration. A slide gated on this must not wait forever for an end. */
  zeroDuration(media: FakeMedia, elementId: string): void {
    media.attach(elementId, { durationMs: 0, positionMs: 0, paused: false })
  },

  /** Plays and never ends — the manifest's duration was wrong, or the stream is live. */
  neverEnds(media: FakeMedia, elementId: string, durationMs = 5000): void {
    media.attach(elementId, { durationMs, positionMs: 0, paused: false })
    media.report(elementId, { positionMs: durationMs, ended: false })
  },

  /** Fails to load. `ADVANCE_MEDIA_FAILED` rather than an indefinite wait. */
  fails(media: FakeMedia, elementId: string): void {
    media.attach(elementId, { failed: true })
    media.report(elementId, { failed: true })
  },
}
