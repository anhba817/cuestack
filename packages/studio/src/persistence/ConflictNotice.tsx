import type { ReactNode } from 'react'
import type { Conflict } from './useDraftPersistence.js'

/**
 * Somebody else saved this lesson, said without standing in the way.
 *
 * **It does not block, and that is the decision worth defending.** The teacher has an hour of
 * work in front of them; a modal between them and it is the surest way to make that work
 * disappear, because people dismiss what blocks them and they dismiss it fastest when they are
 * mid-thought. The answer is to stop *saving*, not to stop *working* (FR-032a, research R-16).
 *
 * It also cannot be dismissed into silence: there is no close button, because a conflict that
 * has been waved away is a conflict the teacher will meet again at the worst moment. It stays
 * until one of the two choices is made.
 *
 * Neither choice discards the other side. Taking the stored version keeps this editor's work
 * locally first; keeping this editor's work saves it forward rather than over theirs. A blind
 * "overwrite anyway" is deliberately absent — the editor cannot show what would be lost, so it
 * would be a choice made in the dark.
 */
export interface ConflictNoticeProps {
  readonly conflict: Conflict
  readonly onTakeStored: () => void
  readonly onKeepMine: () => void
}

export function ConflictNotice({ conflict, onTakeStored, onKeepMine }: ConflictNoticeProps): ReactNode {
  return (
    <div className="cs-conflict" data-cs-conflict="" role="status" aria-live="polite">
      <p>
        {`Someone else has saved “${conflict.lessonId}” since you opened it. Your work is safe ` +
          'here and has not been sent. Nothing is lost either way — choose which to carry on with.'}
      </p>
      <button type="button" data-cs-conflict-keep onClick={onKeepMine}>
        Keep my work and save it as a new draft
      </button>
      <button type="button" data-cs-conflict-take onClick={onTakeStored}>
        Open their version instead
      </button>
    </div>
  )
}
