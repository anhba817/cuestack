import { type ReactNode } from 'react'

export interface AnnouncerProps {
  readonly message: string
}

/**
 * What just happened, for someone who cannot see it happen.
 *
 * A keyboard-driven nudge moves an element by one logical unit. On screen that is obvious and
 * to a screen reader it is nothing at all — so FR-040 requires the change itself to be
 * conveyed, not merely the fact that focus is somewhere.
 *
 * `aria-live="polite"` rather than `assertive`: nudging is a stream of small changes and
 * interrupting the reader on each one makes the editor unusable with the very tool this
 * exists for. `aria-atomic` so the whole sentence is read rather than the diff.
 *
 * Feature 004's accessibility sweep is the precedent. It found the player's progress bar
 * announcing "Slide 3 of 10" with no accessible name — a position with no subject. Every
 * message here names what moved as well as where it went.
 */
export function Announcer({ message }: AnnouncerProps): ReactNode {
  return (
    <div
      className="cs-announcer"
      data-cs-announcer=""
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
    </div>
  )
}

/** One selected element, or a count. Always naming a subject. */
export function describeSelection(
  labels: readonly string[],
): string {
  if (labels.length === 0) return 'Nothing selected. The slide’s own settings are shown.'
  if (labels.length === 1) return `${labels[0]} selected.`
  return `${labels.length} elements selected.`
}

/** A move, in the units the manifest stores, naming what moved. */
export function describeNudge(label: string, x: number, y: number): string {
  return `${label} moved to ${Math.round(x)}, ${Math.round(y)}.`
}
