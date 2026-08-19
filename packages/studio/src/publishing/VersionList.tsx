import type { ReactNode } from 'react'
import type { PublishedVersion } from '@cuestack/core'

/**
 * The published versions of this lesson, newest first.
 *
 * A different list from ED-5's `VersionHistory`, and the difference is the whole feature.
 * That one shows *checkpoints of a draft* — points a teacher can go back to while working. This
 * one shows *what learners were given*, each written once and never changed. The two are not
 * merged for the reason data-model.md §1 separates them: one is working state and the other is a
 * record, and a list that showed both would invite restoring a published version as if it were a
 * draft checkpoint.
 *
 * `publishedAt` is formatted with `Intl.DateTimeFormat`, which takes a timestamp directly.
 * `new Date(ms)` inside `packages/studio/src` **fails** `no-clock-in-studio`, and relative times
 * ("2 hours ago") would need a wall-clock *now* this package is not allowed to read — feature
 * 008's research R-13, unchanged here.
 *
 * Nothing here loads a version's content. A list of forty publications costs forty rows and no
 * lesson data.
 */
export interface VersionListProps {
  readonly versions: readonly PublishedVersion[]
  /** Which one learners currently receive, or null while the lesson is withdrawn. */
  readonly activeId?: string | null
  /** True when the list could not be reached. An empty list would be a lie. */
  readonly unavailable?: boolean
}

const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function VersionList({ versions, activeId = null, unavailable = false }: VersionListProps): ReactNode {
  if (unavailable) {
    return (
      <section className="cs-published" data-cs-published="unavailable" aria-label="Published versions">
        <p>
          The published versions of this lesson cannot be reached at the moment. They have not been
          lost — check your connection and try again.
        </p>
      </section>
    )
  }

  if (versions.length === 0) {
    return (
      <section className="cs-published" data-cs-published="none" aria-label="Published versions">
        <p>This lesson has not been published yet.</p>
      </section>
    )
  }

  return (
    <section className="cs-published" aria-label="Published versions">
      <ul className="cs-published-list">
        {versions.map((version) => (
          <li key={version.id} className="cs-published-version" data-cs-published-version={version.id}>
            <span className="cs-published-number">Version {version.versionNumber}</span>
            <span className="cs-published-when">{formatter.format(version.publishedAt)}</span>
            <span className="cs-published-by">{version.publishedBy}</span>
            {/* Stated as a word, never as a highlight alone (NFR-ACC-003). */}
            {version.id === activeId ? (
              <span className="cs-published-active" data-cs-published-active>
                Live now
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
