/**
 * What the kernel can learn about a media element.
 *
 * Read-only by design (research R-04). The kernel decides what a media position
 * *means* for advancement; the adapter decides how it is learned. Keeping the port
 * one-directional keeps that division clear.
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
}
