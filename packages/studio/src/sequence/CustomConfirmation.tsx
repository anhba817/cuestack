import type { ReactNode } from 'react'

export interface CustomConfirmationProps {
  readonly label: string
  /** Where the event is now — timing the teacher authored on purpose. */
  readonly currentMs: number
  /** Where the relationship would put it. */
  readonly proposedMs: number
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

const seconds = (ms: number): string => (ms / 1000).toFixed(2)

/**
 * Making a Custom event simple again, with what it would cost stated first.
 *
 * **Not a courtesy dialogue.** The event is Custom because its timing matches no simple
 * relationship, and a teacher put it there deliberately — running a title in halfway through
 * a paragraph is a thing people mean. Applying a relationship *discards* that, and undo does
 * not exist until ED-5, so the confirmation is the only thing standing between an experiment
 * and a loss.
 *
 * The message states both numbers rather than "this will change the timing" (FR-032,
 * NFR-USA-004): the problem, the affected object, and what will happen.
 */
export function CustomConfirmation({
  label,
  currentMs,
  proposedMs,
  onConfirm,
  onCancel,
}: CustomConfirmationProps): ReactNode {
  return (
    <div className="cs-sequence-confirm" role="alertdialog" aria-label={`Make ${label} follow the previous event?`}>
      <p>
        {`“${label}” starts at ${seconds(currentMs)} seconds. Following the previous event would ` +
          `move it to ${seconds(proposedMs)} seconds, and the timing you set would be lost.`}
      </p>
      <button type="button" onClick={onConfirm}>
        Move it
      </button>
      <button type="button" onClick={onCancel}>
        Keep the timing I set
      </button>
    </div>
  )
}
