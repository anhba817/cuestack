import { useEffect, useRef, type ReactNode } from 'react'
import type { Element } from '@cuestack/schema'

export interface DeleteConfirmationProps {
  readonly elements: readonly Element[]
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

/**
 * The only route to a `delete` edit.
 *
 * Constitution III requires destructive actions to be undoable **or** confirmed, and this
 * feature takes the second of the two. That is deliberately the lower bar and it is recorded
 * as temporary: FR-CAN-011 and ED-5 bring real undo, and when they do this prompt should be
 * *removed* rather than kept alongside it. A tool that both confirms and undoes every deletion
 * is one that has stopped trusting its own history.
 *
 * Confirmed once for a whole selection, not once per element — seven prompts to delete seven
 * things is how a teacher learns to click through prompts without reading them, which costs
 * more safety than it buys.
 *
 * The prompt names what will go. "Delete 3 elements?" is answerable; "Are you sure?" is not.
 */
export function DeleteConfirmation({
  elements,
  onConfirm,
  onCancel,
}: DeleteConfirmationProps): ReactNode {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const returnTo = useRef<Element | null>(null)

  useEffect(() => {
    // Remembered before focus moves, so cancelling puts the teacher back where they were
    // rather than at the top of the document (FR-039).
    returnTo.current = document.activeElement as Element | null
    confirmRef.current?.focus()
    return () => {
      const target = returnTo.current
      if (target && 'focus' in target) (target as unknown as HTMLElement).focus()
    }
  }, [])

  const description =
    elements.length === 1
      ? `Delete the ${elements[0]!.accessibility?.label ?? elements[0]!.type} element?`
      : `Delete ${elements.length} elements?`

  return (
    <div
      className="cs-confirm"
      data-cs-confirm="delete"
      role="alertdialog"
      aria-modal="true"
      aria-label={description}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onCancel()
        }
      }}
    >
      <p className="cs-confirm-message">{description}</p>
      <p className="cs-confirm-note">
        This cannot be undone yet — undo arrives with the editor&rsquo;s history.
      </p>
      <div className="cs-confirm-actions">
        <button ref={confirmRef} type="button" data-cs-confirm-delete="" onClick={onConfirm}>
          Delete
        </button>
        <button type="button" data-cs-confirm-cancel="" onClick={onCancel}>
          Keep
        </button>
      </div>
    </div>
  )
}
