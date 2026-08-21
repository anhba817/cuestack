import type { ReactNode } from 'react'
import type { ElementRenderer, ElementRendererProps } from '../registry.js'

type ButtonAction = 'next_slide' | 'previous_slide' | 'replay_slide' | 'open_url'

interface ButtonPayload {
  readonly label?: string
  readonly action?: ButtonAction
  readonly url?: string
}

/**
 * A button.
 *
 * A real `<button>`, or a real `<a>` when the action is a link. Not a styled `<div>` with a
 * click handler: the native elements bring keyboard operability, focus behaviour, and the
 * right role for free, and every hand-rolled substitute has to earn all three back.
 *
 * **All four actions work.** The three navigation ones were inert from Wave 2 until feature 012,
 * under a note in this header promising "the seam Wave 3 wires up" — Wave 3 shipped, then 4, then
 * 5. A teacher's default button, `next_slide` labelled "Continue", rendered correctly and did
 * nothing.
 *
 * A renderer still receives only its element and a narrow capability. It is handed a verb and no
 * nouns: `navigation.act()` performs *this button's* authored action and takes no argument, so a
 * renderer cannot perform any other. It never learns that a transport exists — which is what lets
 * the lesson shape change without breaking third-party renderers.
 */
function ButtonComponent({ element, navigation }: ElementRendererProps): ReactNode {
  const payload = element.payload as ButtonPayload | undefined
  const label = payload?.label ?? element.accessibility?.label ?? 'Button'
  const action = payload?.action ?? 'next_slide'

  if (action === 'open_url' && payload?.url !== undefined) {
    return (
      <a
        className="cs-element-button"
        href={payload.url}
        // A lesson may be embedded in a host's page; taking the learner away from it
        // mid-lesson loses their place. `noreferrer` because the lesson URL is not the
        // link target's business.
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </a>
    )
  }

  /**
   * `aria-disabled`, not `disabled` — and what it guards has changed.
   *
   * The choice is the same and the reason is the same: a `disabled` button leaves the tab order,
   * so a learner using a screen reader would never reach it to hear that it is inert. Announcing
   * an inoperable control is worse than announcing why it is inoperable.
   *
   * What it *means* is different. It used to say "this framework has not wired this up" — for
   * every navigation action, permanently, for three waves. It now says "this action has nowhere
   * to go from here": Back on the first slide, Continue on the last, or Continue on a slide that
   * waits for a required question. A fact about the lesson rather than about the framework.
   */
  const operable = navigation?.available === true

  return (
    <button
      className="cs-element-button"
      type="button"
      data-cs-action={action}
      {...(operable ? {} : { 'aria-disabled': 'true' as const })}
      onClick={operable ? navigation?.act : undefined}
    >
      {label}
    </button>
  )
}

export const buttonRenderer: ElementRenderer = {
  type: 'button',
  Component: ButtonComponent,
  label: 'Button',
}
