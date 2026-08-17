import type { Element, Slide } from '@cuestack/schema'

export type EventKind = 'element' | 'effect'

/**
 * The unit a sequence orders.
 *
 * Derived by reading the slide, never stored. It exists because a teacher revealing a list
 * one line at a time is sequencing *effects*, and a mode that could only order elements would
 * send them to the timeline for the commonest case it exists to serve (FR-035, UC-02).
 */
export interface SequenceEvent {
  readonly kind: EventKind
  readonly elementId: string
  /** Present iff `kind === 'effect'`. */
  readonly effectId?: string
  readonly startMs: number
  readonly endMs: number
  readonly label: string
}

interface StoredEffect {
  readonly id: string
  readonly type: string
  readonly startMs: number
  readonly durationMs: number
  readonly order: number
}

/**
 * The key an edit addresses an event by.
 *
 * Derived rather than minted: an event has no id of its own, and giving it one would be
 * storage — which Constitution III forbids for this mode outright (FR-029).
 */
export function keyOf(event: SequenceEvent): string {
  return event.effectId === undefined ? event.elementId : `${event.elementId}:${event.effectId}`
}

function labelOf(element: Element): string {
  const el = element as unknown as {
    accessibility?: { label?: string; altText?: string }
    payload?: { text?: string; label?: string }
    type: string
    id: string
  }
  return (
    el.accessibility?.label ?? el.accessibility?.altText ?? el.payload?.text ?? el.payload?.label ?? `${el.type} ${el.id}`
  )
}

/**
 * Every event on a slide, in the order they happen.
 *
 * **Ordering, stated because "previous" is undefined without it:** by `startMs` ascending,
 * then by the owning element's paint order, then by `Effect.order`. That is the same
 * tie-break the resolver already uses, so the sequence view and playback never disagree about
 * which of two simultaneous things comes first — and `Effect.order` exists for exactly this
 * case (FR-TIM-014), so reusing it keeps one answer to the question.
 *
 * **An effect's time needs no conversion.** `Effect.startMs` is documented in the schema as
 * relative to *slide* time, not element time, which is the whole reason one ordered list can
 * hold both kinds. An effect may therefore legally precede the element it belongs to, and
 * this function reports that rather than hiding it.
 *
 * Hidden and locked elements both produce events. Hiding affects playback, not authoring
 * order; locking refuses an *edit*, not a listing.
 *
 * Pure. No React, no DOM, no clock.
 */
export function eventsOf(slide: Slide): readonly SequenceEvent[] {
  const elements = slide.elements as readonly Element[]

  // Paint order, resolved once: zIndex, then array position — `resolve/index.ts` exactly.
  const painted = elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => {
      const az = (a.element as unknown as { zIndex: number }).zIndex
      const bz = (b.element as unknown as { zIndex: number }).zIndex
      return az - bz || a.index - b.index
    })
  const paintRank = new Map(painted.map((entry, rank) => [entry.element, rank]))

  const events: (SequenceEvent & { paint: number; order: number })[] = []

  for (const element of elements) {
    const el = element as unknown as { id: string; startMs: number; endMs: number; effects?: readonly StoredEffect[] }
    const paint = paintRank.get(element) ?? 0
    const label = labelOf(element)

    events.push({
      kind: 'element',
      elementId: el.id,
      startMs: el.startMs,
      endMs: el.endMs,
      label,
      paint,
      order: -1, // an element sorts before its own effects when they share a start
    })

    for (const effect of el.effects ?? []) {
      events.push({
        kind: 'effect',
        elementId: el.id,
        effectId: effect.id,
        startMs: effect.startMs,
        endMs: effect.startMs + effect.durationMs,
        label: `${effect.type} on ${label}`,
        paint,
        order: effect.order,
      })
    }
  }

  events.sort((a, b) => a.startMs - b.startMs || a.paint - b.paint || a.order - b.order)

  return events.map(({ paint: _paint, order: _order, ...event }) => event)
}
