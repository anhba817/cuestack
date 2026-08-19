import { useMemo, type ReactNode } from 'react'
import type { Slide } from '@cuestack/schema'
import type { EditorSession } from '../session/useEditorSession.js'
import type { SequenceAssignment, SequenceRelationship } from '../draft/edit.js'
import { eventsOf, keyOf } from './events.js'
import { classify } from './relationships.js'
import { SequenceRow } from './SequenceRow.js'

export interface SequenceViewProps {
  readonly session: EditorSession
}

/**
 * Simple Sequence: the same timing data, said in a teacher's words.
 *
 * §7.1's "simple first, precision on demand". Everything here is **derived** — the
 * relationships are computed from absolute times on every render, because Constitution III
 * forbids mode-specific storage outright. Switching to the timeline changes nothing, because
 * there was never a second copy to lose.
 *
 * **Reordering re-classifies; it does not re-resolve.** A stacking change changes what this
 * view *shows*, never what the draft holds — only applying a relationship writes timing. The
 * alternative, which an earlier draft of the specification carried, would have been a
 * destructive edit produced by a non-timing action, with no undo behind it until ED-5.
 *
 * The scope is also narrower than it sounds: events sort by start time first and by paint
 * order only as a tie-break, so reordering three elements that begin at different moments
 * changes "previous" not at all.
 */
export function SequenceView({ session }: SequenceViewProps): ReactNode {
  const slide = (session.draft.slides.find((s) => s.id === session.slideId) ??
    session.draft.slides[0]!) as Slide

  const events = useMemo(() => eventsOf(slide), [slide])
  const relationships = useMemo(() => classify(events), [events])
  const disabled = session.mode === 'read-only'


  const apply = (index: number, relationship: SequenceRelationship): void => {
    const next = relationships.map((existing, i) => (i === index ? relationship : existing))
    const assignments: SequenceAssignment[] = events.map((event, i) => ({
      eventKey: keyOf(event),
      relationship: next[i]!,
    }))
    session.apply({ kind: 'apply-sequence', relationships: assignments })
  }

  /**
   * Applied at once, Custom included.
   *
   * Feature 006 put a confirmation in front of leaving a Custom event, because applying a
   * relationship discards timing a teacher set deliberately and undo did not exist. Its own
   * comment said so: "undo does not exist until ED-5, so the confirmation is the only thing
   * standing between an experiment and a loss." Undo exists, so the prompt is gone (FR-012).
   */
  const choose = (index: number, kind: SequenceRelationship['kind']): void => {
    const relationship: SequenceRelationship =
      kind === 'after-previous-delay' ? { kind, delayMs: 500 } : ({ kind } as SequenceRelationship)
    apply(index, relationship)
  }


  return (
    <section className="cs-sequence" aria-label="Sequence">
      {events.length === 0 ? (
        <p className="cs-sequence-empty">
          Nothing on this slide yet. Add an element and it will appear here, in the order it happens.
        </p>
      ) : (
        <ol className="cs-sequence-list">
          {events.map((event, index) => (
            <SequenceRow
              key={keyOf(event)}
              event={event}
              relationship={relationships[index]!}
              first={index === 0}
              disabled={disabled}
              onChoose={(kind) => choose(index, kind)}
              onDelay={(delayMs) => apply(index, { kind: 'after-previous-delay', delayMs })}
            />
          ))}
        </ol>
      )}
    </section>
  )
}
