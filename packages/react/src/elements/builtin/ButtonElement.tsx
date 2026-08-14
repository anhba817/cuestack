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
 * **`open_url` works now. The navigation actions do not.** Advancing a slide needs the
 * transport, and a renderer receives only its element — deliberately, so that the lesson
 * shape can change without breaking third-party renderers. The action reaches the markup as
 * a data attribute, which is the seam Wave 3 wires up through the player rather than by
 * handing every renderer a transport.
 *
 * Until then, `aria-disabled` rather than `disabled`: a `disabled` button leaves the tab
 * order, so a learner using a screen reader would never reach it to hear that it is inert.
 * Announcing an inoperable control is worse than announcing why it is inoperable.
 */
function ButtonComponent({ element }: ElementRendererProps): ReactNode {
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

  return (
    <button
      className="cs-element-button"
      type="button"
      data-cs-action={action}
      aria-disabled="true"
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
