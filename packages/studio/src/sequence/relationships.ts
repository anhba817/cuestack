import type { SequenceEvent } from './events.js'
import { keyOf } from './events.js'
import type { SequenceAssignment, SequenceRelationship } from '../draft/edit.js'

/** What resolving a sequence asks the reducer to write. Nothing else moves. */
export interface TimingChange {
  readonly eventKey: string
  readonly startMs: number
  /** Elements carry an end; effects carry a duration, so an end is not written for them. */
  readonly endMs?: number
}

/**
 * How each event stands to the one before it.
 *
 * **Exact equality, deliberately.** A tolerance would make two teachers' identical-looking
 * slides classify differently, and the format stores integer milliseconds so exactness is
 * achievable. One millisecond after the previous end is a *delay of one*, not After Previous.
 *
 * **Adjacency is the only input** (FR-036). Neither event's `kind` appears anywhere below,
 * which is what makes all four shapes — element→element, effect→effect, element→effect,
 * effect→element — take the same path by construction. A classifier that grew a "do they
 * share an element?" branch would pass every other assertion in this suite and fail only the
 * adjacency one.
 *
 * Pure. Stores nothing: Constitution III forbids mode-specific storage, so a relationship is
 * a classification computed on read rather than a flag on a manifest.
 */
export function classify(events: readonly SequenceEvent[]): readonly SequenceRelationship[] {
  return events.map((event, index) => {
    const previous = events[index - 1]
    if (!previous) return { kind: 'first' }
    if (event.startMs === previous.startMs) return { kind: 'with-previous' }
    if (event.startMs === previous.endMs) return { kind: 'after-previous' }
    if (event.startMs > previous.endMs) {
      return { kind: 'after-previous-delay', delayMs: event.startMs - previous.endMs }
    }
    return { kind: 'custom' }
  })
}

/**
 * The absolute times a sequence implies.
 *
 * Returns changes; writes nothing. Applying them is the reducer's job, and keeping those
 * apart is what lets this be a pure function that Constitution II can require to be written
 * first.
 *
 * Durations are preserved throughout: moving an element's start moves its end by the same
 * amount, and an effect keeps its `durationMs`. A sequence says *when* things happen, never
 * how long they last.
 *
 * `custom` and `first` resolve to what the event already has — `custom` because the teacher
 * authored that timing on purpose and this function is not the place that discards it, and
 * `first` because the slide's beginning is where a sequence starts (FR-033).
 */
export function resolveSequence(
  events: readonly SequenceEvent[],
  relationships: readonly SequenceRelationship[],
): readonly TimingChange[] {
  const changes: TimingChange[] = []
  /** Where each event landed, so the next one can be placed against it. */
  let previous: { startMs: number; endMs: number } | null = null

  events.forEach((event, index) => {
    const relationship = relationships[index] ?? { kind: 'custom' as const }
    const duration = event.endMs - event.startMs

    let startMs = event.startMs
    if (!previous) {
      startMs = 0
    } else if (relationship.kind === 'with-previous') {
      startMs = previous.startMs
    } else if (relationship.kind === 'after-previous') {
      startMs = previous.endMs
    } else if (relationship.kind === 'after-previous-delay') {
      startMs = previous.endMs + relationship.delayMs
    }

    startMs = Math.max(0, Math.round(startMs))
    const endMs = startMs + duration

    changes.push(
      event.effectId === undefined
        ? { eventKey: keyOf(event), startMs, endMs }
        : { eventKey: keyOf(event), startMs },
    )
    previous = { startMs, endMs }
  })

  return changes
}

/** Pair each event's key with the relationship a surface has chosen for it. */
export function assignmentsFor(
  events: readonly SequenceEvent[],
  relationships: readonly SequenceRelationship[],
): readonly SequenceAssignment[] {
  return events.map((event, index) => ({
    eventKey: keyOf(event),
    relationship: relationships[index] ?? { kind: 'custom' },
  }))
}
