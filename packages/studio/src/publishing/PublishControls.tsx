import type { ReactNode } from 'react'
import { SaveStatus } from '../persistence/SaveStatus.js'
import type { SaveState } from '../persistence/useDraftPersistence.js'
import type { PublishOutcome, Publishing } from './usePublishing.js'

/**
 * Publish, withdraw, restore — and what stopped any of them.
 *
 * **The status word comes from ED-5's component, not from a second one.** Constitution III:
 * "Save and publish status MUST use one shared component and one vocabulary across the
 * application: Saving, Saved, Offline, Save Failed." So a publish in flight reads *Saving* and a
 * refused one reads *Save Failed*, which sounds imprecise until you consider the alternative — a
 * fifth and sixth word for a teacher to learn, in a product where "inconsistency is
 * indistinguishable from a bug to a non-technical user". The precision lives in the message
 * beneath, which names which of the six refusals happened and what to do about it (NFR-USA-004).
 *
 * **Unreachable maps to Offline** rather than to failure, because it is the one refusal that will
 * probably resolve itself, and telling someone to retry is different from telling them to fix
 * something.
 */
export interface PublishControlsProps {
  readonly publishing: Publishing
  /** Whether a version is currently active, which decides between Withdraw and Restore. */
  readonly active?: boolean
  readonly canWithdraw?: boolean
}

function statusOf(outcome: PublishOutcome | null, busy: boolean): SaveState | null {
  if (busy) return { kind: 'saving' }
  if (outcome === null) return null
  if (outcome.ok) return { kind: 'saved' }
  return outcome.reason === 'unavailable'
    ? { kind: 'offline', message: outcome.message }
    : { kind: 'failed', message: outcome.message }
}

export function PublishControls({
  publishing,
  active = false,
  canWithdraw = true,
}: PublishControlsProps): ReactNode {
  const { outcome, busy } = publishing
  const status = statusOf(outcome, busy)

  return (
    <div className="cs-publish" aria-label="Publishing">
      <button type="button" data-cs-publish onClick={() => void publishing.publish()} disabled={busy}>
        Publish
      </button>
      {canWithdraw && active ? (
        <button
          type="button"
          data-cs-withdraw
          onClick={() => void publishing.withdraw()}
          disabled={busy}
        >
          Withdraw
        </button>
      ) : null}
      {canWithdraw && !active && outcome !== null ? (
        <button
          type="button"
          data-cs-restore
          onClick={() => void publishing.restore()}
          disabled={busy}
        >
          Restore
        </button>
      ) : null}

      {status ? <SaveStatus state={status} /> : null}

      {outcome && !outcome.ok && outcome.issues ? (
        <ul className="cs-publish-blockers" data-cs-publish-blockers>
          {outcome.issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}

      {outcome && !outcome.ok && outcome.assetIds ? (
        <ul className="cs-publish-blockers" data-cs-publish-missing-assets>
          {outcome.assetIds.map((assetId) => (
            <li key={assetId}>{`The file "${assetId}" could not be found.`}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
