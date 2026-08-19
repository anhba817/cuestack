import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Work an interruption left behind, offered before the lesson opens.
 *
 * A modal `<dialog>`, following the pattern feature 007 established for the preview: the top
 * layer, the inertness, the focus containment, and Escape all come from the platform rather
 * than from anything written here.
 *
 * **It blocks, and a conflict does not.** The editor cannot render a lesson until it knows
 * which copy it is rendering, so asking first costs nothing and showing either one would be
 * the silent application FR-027 forbids. A conflict arrives with an hour of the teacher's work
 * already on screen, where a dialogue is the surest way to lose it (research R-16).
 */
export interface RecoveryPromptProps {
  /** True when somebody else saved the lesson since this work was kept (FR-027b). */
  readonly movedOn: boolean
  readonly onRestore: () => void
  readonly onDiscard: () => void
}

export function RecoveryPrompt({ movedOn, onRestore, onDiscard }: RecoveryPromptProps): ReactNode {
  const dialog = useRef<HTMLDialogElement | null>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="cs-recovery"
      data-cs-recovery=""
      aria-label="Unsaved work was found"
      // No `onCancel` handler that closes: Escape must not be a third answer. Either choice
      // is deliberate, and dismissing would leave the editor with no lesson to show.
      onCancel={(event) => event.preventDefault()}
    >
      <p>
        {movedOn
          ? 'This lesson has unsaved work from an interrupted session, and it has also been ' +
            'saved by someone else since. Restoring your work will not overwrite theirs — you ' +
            'will be asked what to do when it next saves.'
          : 'This lesson has unsaved work from an interrupted session.'}
      </p>
      <button type="button" data-cs-recovery-restore onClick={onRestore} autoFocus>
        Restore my work
      </button>
      <button type="button" data-cs-recovery-discard onClick={onDiscard}>
        Discard it and open the saved lesson
      </button>
    </dialog>
  )
}
