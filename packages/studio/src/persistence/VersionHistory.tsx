import type { ReactNode } from 'react'
import type { VersionEntry } from '@cuestack/core'

/**
 * The checkpoints a teacher can go back to, newest first.
 *
 * **Checkpoints, not saves.** Autosave fires roughly every 1.5 seconds of idle, so an hour of
 * editing is hundreds of writes; all of them advance the version the editor holds and almost
 * none of them belong in a list a person reads (FR-035, FR-036).
 *
 * `recordedAt` is formatted with `Intl.DateTimeFormat`, which takes a timestamp directly.
 * That is not a stylistic preference: `new Date(ms)` inside `packages/studio/src` **fails**
 * `no-clock-in-studio`, and relative times ("2 hours ago") would need a wall-clock *now* the
 * editor is not allowed to read (research R-13).
 *
 * Nothing here loads a version's content — a history of two hundred checkpoints costs two
 * hundred rows and no lesson data.
 */
export interface VersionHistoryProps {
  readonly versions: readonly VersionEntry[]
  /** True when the history could not be reached. An empty list would be a lie (FR-043). */
  readonly unavailable: boolean
  /** Absent in read-only: restoring is not offered, and the refusal is only the backstop. */
  readonly onRestore?: (token: string) => void
}

const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function VersionHistory({ versions, unavailable, onRestore }: VersionHistoryProps): ReactNode {
  if (unavailable) {
    return (
      <section className="cs-versions" data-cs-versions="unavailable" aria-label="Version history">
        <p>
          The earlier versions of this lesson cannot be reached at the moment. They have not been
          lost — check your connection and try again.
        </p>
      </section>
    )
  }

  return (
    <section className="cs-versions" data-cs-versions="" aria-label="Version history">
      {versions.length === 0 ? (
        <p>No earlier versions yet. One is kept each time you save after a spell of work.</p>
      ) : (
        <ol className="cs-versions-list">
          {versions.map((entry) => (
            <li key={entry.token} className="cs-version" data-cs-version={entry.token}>
              <span className="cs-version-when">{formatter.format(entry.recordedAt)}</span>
              {entry.label ? <span className="cs-version-label">{entry.label}</span> : null}
              {onRestore ? (
                <button
                  type="button"
                  data-cs-version-restore={entry.token}
                  onClick={() => onRestore(entry.token)}
                >
                  {`Restore the version from ${formatter.format(entry.recordedAt)}`}
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
