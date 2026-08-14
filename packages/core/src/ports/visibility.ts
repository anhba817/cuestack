/**
 * Whether the host document is hidden.
 *
 * Exists so BR-013 can be honoured without the kernel touching `document`.
 */
export interface VisibilityPort {
  isHidden(): boolean
  subscribe(listener: (hidden: boolean) => void): () => void
}
