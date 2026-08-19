import type { ReactNode } from 'react'
import type { RecordEntry } from '@cuestack/core'

/**
 * What happened to this lesson, in order, and who did it.
 *
 * The question this answers arrives months later: *who took this down, and when?* — asked when
 * nobody involved remembers. That is why it is a record rather than a status, and why nothing here
 * offers to change one: the adapter has no method that edits an entry, and a view that implied
 * otherwise would be promising something no host can deliver (BR-008's sibling).
 *
 * Oldest first, unlike the version list. A record is read as a sequence — this, then this, then
 * this — and reversing it makes a reader assemble the story backwards.
 *
 * `at` is formatted with `Intl.DateTimeFormat` for the reason every date in this package is:
 * `new Date(ms)` fails `no-clock-in-studio`.
 */
export interface PublicationRecordProps {
  readonly entries: readonly RecordEntry[]
  /** True when the record could not be reached. An empty list would be a lie. */
  readonly unavailable?: boolean
}

const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** The action in a teacher's words rather than the stored token. */
const WORDS: Record<RecordEntry['action'], string> = {
  published: 'Published',
  withdrawn: 'Withdrawn',
  restored: 'Restored',
}

export function PublicationRecord({ entries, unavailable = false }: PublicationRecordProps): ReactNode {
  if (unavailable) {
    return (
      <section className="cs-record" data-cs-record="unavailable" aria-label="Publication record">
        <p>
          The record for this lesson cannot be reached at the moment. Nothing has been lost — check
          your connection and try again.
        </p>
      </section>
    )
  }

  if (entries.length === 0) {
    return (
      <section className="cs-record" data-cs-record="none" aria-label="Publication record">
        <p>Nothing has been published or withdrawn yet.</p>
      </section>
    )
  }

  return (
    <section className="cs-record" aria-label="Publication record">
      <ol className="cs-record-list">
        {entries.map((entry, index) => (
          <li key={`${entry.at}-${index}`} className="cs-record-entry" data-cs-record-action={entry.action}>
            <span className="cs-record-what">{WORDS[entry.action]}</span>
            <span className="cs-record-who">{entry.actor}</span>
            <span className="cs-record-when">{formatter.format(entry.at)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
