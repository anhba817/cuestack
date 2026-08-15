/**
 * What the kernel can learn about a media element, and what it can ask of one.
 *
 * **Bidirectional as of Wave 3**, amending feature 002's research R-04. That decision — the
 * kernel decides what a position *means*, the adapter decides how it is learned — is still
 * right, and the division still holds: the kernel gained commands, not knowledge of how a
 * `<video>` works.
 *
 * What changed is that Wave 2 shipped a seek control. Leaving media uncommandable meant that
 * control visibly desynchronised the lesson from its video on every media slide, which is
 * worse than never having shipped it. Wave 4's editor timeline needs media seeking anyway.
 *
 * The reconciliation this invites lives in exactly one place — `media/reconcile.ts`, FR-037
 * — because two clocks are now unavoidable and two *policies* for reconciling them are not.
 */
export interface MediaStatus {
  readonly positionMs: number
  /** null while still unknown. */
  readonly durationMs: number | null
  readonly ended: boolean
  readonly paused: boolean
  /**
   * A media-gated slide must be able to report blocked rather than waiting
   * forever for a video that will never load.
   */
  readonly failed: boolean
}

export interface MediaPort {
  /** null when nothing is attached for that element yet. */
  query(elementId: string): MediaStatus | null
  subscribe(listener: (elementId: string) => void): () => void

  /**
   * Commands. **Fire-and-forget, and never throwing.**
   *
   * A media element that is not attached, has failed, or simply refuses is not an error the
   * kernel can act on — the truth arrives through the next `query`, which is the route every
   * other fact about media takes. Returning a promise would invite the lesson to await one,
   * and a lesson that waits on a video is a lesson that stalls.
   *
   * An adapter that implements these as no-ops behaves exactly as Wave 1's did, so the
   * addition breaks no existing implementation.
   */
  play(elementId: string): void
  pause(elementId: string): void
  seek(elementId: string, positionMs: number): void
}
