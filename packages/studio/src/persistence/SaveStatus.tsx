import type { ReactNode } from 'react'
import type { SaveState } from './useDraftPersistence.js'

/**
 * One component, four words, shared with publishing.
 *
 * Constitution III fixes the vocabulary: "Save and publish status MUST use one shared
 * component and one vocabulary across the application: Saving, Saved, Offline, Save Failed."
 * So its prop is a **status**, not a draft — PB-2 renders a publish state through this same
 * component rather than growing a second one and a fifth word.
 *
 * **Never blank.** Seven internal states map to four words: `pending` and `saving` both read
 * Saving, `idle` and `saved` both read Saved. A lesson with nothing outstanding matches what
 * storage holds, which is the same claim as one just written to it — so Saved is true on open,
 * not a placeholder standing in for silence (FR-016).
 *
 * State is never conveyed by colour alone (NFR-ACC-003): the word is the state, and the
 * failure carries its reason as prose.
 */
export interface SaveStatusProps {
  readonly state: SaveState
  /** Offered when the automatic attempts are spent, so the teacher has a way forward. */
  readonly onRetry?: () => void
}

const WORDS: Record<SaveState['kind'], string> = {
  idle: 'Saved',
  saved: 'Saved',
  pending: 'Saving',
  saving: 'Saving',
  offline: 'Offline',
  failed: 'Save Failed',
}

export function SaveStatus({ state, onRetry }: SaveStatusProps): ReactNode {
  const word = WORDS[state.kind]
  return (
    <div
      className="cs-save-status"
      data-cs-save-status={state.kind}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="cs-save-status-word">{word}</span>
      {state.message ? <span className="cs-save-status-detail">{state.message}</span> : null}
      {state.attemptsSpent && onRetry ? (
        <button type="button" data-cs-save-retry onClick={onRetry}>
          Try saving again
        </button>
      ) : null}
    </div>
  )
}
