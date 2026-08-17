import type { Element, Slide } from '@cuestack/schema'

/**
 * One element's timing, drawn.
 *
 * Derived on read and never stored — the timeline is a view of authored data, not a second
 * copy of it (FR-044).
 */
export interface Track {
  readonly elementId: string
  readonly startMs: number
  readonly endMs: number
  readonly locked: boolean
  readonly hidden: boolean
  /** The element's accessible name, so the track has one too. */
  readonly label: string
  readonly effects: readonly EffectBar[]
}

export interface EffectBar {
  readonly effectId: string
  readonly type: string
  readonly phase: string
  readonly startMs: number
  /** Derived: `startMs + durationMs`. The format stores a duration; a bar needs an end. */
  readonly endMs: number
}

/** Best-effort human name for a track, in the order a teacher would recognise it. */
function labelOf(element: Element): string {
  const el = element as unknown as {
    accessibility?: { label?: string; altText?: string }
    payload?: { text?: string; label?: string }
    type: string
    id: string
  }
  const candidate =
    el.accessibility?.label ??
    el.accessibility?.altText ??
    el.payload?.text ??
    el.payload?.label ??
    `${el.type} ${el.id}`
  return candidate.length > 60 ? `${candidate.slice(0, 57)}…` : candidate
}

/**
 * A track per element on the slide, in paint order.
 *
 * **Built from the draft, never from `RenderState`.** The resolver answers "what is on
 * screen at this moment", and its `elements` are documented as visible ones only: a hidden
 * element is absent by design (BR-010), and so is one outside its window. A timeline built
 * from that would drop a track exactly when the teacher wants to change the timing that
 * made it disappear — and hiding an element would silently remove its ability to be re-timed
 * (FR-003, research R-03).
 *
 * This module therefore imports nothing from the resolver, which is asserted rather than
 * merely intended: `tracks.pure.test.ts` builds a slide nothing would render at time zero
 * and expects a full set back.
 *
 * Pure, and in the `node` test project. Order is the array's own — the resolver sorts by
 * `zIndex` for painting, but a teacher reads a track list in the order they built it, and
 * re-sorting here would make a reorder shuffle rows for a reason nobody asked for.
 */
export function buildTracks(slide: Slide): readonly Track[] {
  return (slide.elements as readonly Element[]).map((element) => {
    const el = element as unknown as {
      id: string
      startMs: number
      endMs: number
      locked?: boolean
      hidden?: boolean
      effects?: readonly { id: string; type: string; phase: string; startMs: number; durationMs: number }[]
    }
    return {
      elementId: el.id,
      startMs: el.startMs,
      endMs: el.endMs,
      locked: el.locked === true,
      hidden: el.hidden === true,
      label: labelOf(element),
      effects: (el.effects ?? []).map((effect) => ({
        effectId: effect.id,
        type: effect.type,
        phase: effect.phase,
        startMs: effect.startMs,
        endMs: effect.startMs + effect.durationMs,
      })),
    }
  })
}
