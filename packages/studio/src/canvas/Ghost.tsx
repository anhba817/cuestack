import type { ReactNode } from 'react'
import type { Element } from '@cuestack/schema'

/** Why the learner would not see this element at the current authoring time. */
export type GhostReason = 'not-yet' | 'no-longer' | 'hidden'

export interface GhostProps {
  readonly element: Element
  readonly reason: GhostReason
  readonly selected: boolean
  readonly onSelect: () => void
}

const WORDING: Record<GhostReason, string> = {
  'not-yet': 'not yet visible',
  'no-longer': 'no longer visible',
  hidden: 'hidden from learners',
}

/**
 * An element the resolver left out, shown so it can still be authored.
 *
 * **An affordance, not a render.** It draws an outline, a label, and a reason at the
 * *authored* geometry; it never invokes the element's renderer. That is the honest artifact:
 * it does not pretend to show what a learner sees, because at this moment a learner sees
 * nothing there. Resolving the element at a time inside its own window would put a frame on
 * screen that occurs at no single moment of the lesson — a parity lie told in the one place
 * teachers are being asked to trust (research R-02).
 *
 * `hidden` wins when an element is both hidden and outside its window: hiding is a decision
 * the teacher made, and timing is a detail of a thing they have already taken off the slide.
 */
export function Ghost({ element, reason, selected, onSelect }: GhostProps): ReactNode {
  const label = element.accessibility?.label ?? element.type

  return (
    <button
      type="button"
      className="cs-ghost"
      data-cs-ghost={reason}
      data-cs-element-id={element.id}
      aria-pressed={selected}
      onClick={onSelect}
      style={
        {
          '--cs-x': String(element.x),
          '--cs-y': String(element.y),
          '--cs-w': String(element.width),
          '--cs-h': String(element.height),
        } as React.CSSProperties
      }
    >
      {/* The reason is text, not a colour or a dash pattern. NFR-ACC-005: essential
          information never travels by appearance alone, and "why is this not showing" is
          the whole point of the affordance. */}
      <span className="cs-ghost-label">{`${label} — ${WORDING[reason]}`}</span>
    </button>
  )
}

/**
 * Which reason applies, from the element and the moment.
 *
 * Exported so the overlay can label without duplicating the rule, and so the ghost suite can
 * assert the classification without rendering.
 */
export function ghostReason(element: Element, authoringTime: number): GhostReason {
  if (element.hidden) return 'hidden'
  return authoringTime < element.startMs ? 'not-yet' : 'no-longer'
}
