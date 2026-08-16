import type { ReactNode } from 'react'
import type { Slide } from '@cuestack/schema'
import type { EditorSession } from '../session/useEditorSession.js'

export interface AuthoringTimeProps {
  readonly session: EditorSession
  readonly slide: Slide
}

/**
 * The moment the canvas is showing.
 *
 * One number per slide, not a timeline. It shows no tracks, no per-element bars, and nothing
 * draggable in time — ED-3 brings those, and when it does it must set *this* value rather
 * than introduce a second time model beside it (data-model.md §5, and the obligation recorded
 * in spec.md).
 *
 * A range input, so it is keyboard-operable for free: arrows step, Home and End jump, and the
 * browser handles it. `aria-valuetext` carries a subject as well as a number — feature 004's
 * accessibility sweep found the player's progress bar announcing "Slide 3 of 10" with no
 * accessible name, so a learner heard a position with nothing it belonged to. The same
 * mistake is available here and this is where it is refused (FR-037).
 */
export function AuthoringTime({ session, slide }: AuthoringTimeProps): ReactNode {
  const seconds = (ms: number) => (ms / 1000).toFixed(1)

  return (
    <div className="cs-time" data-cs-authoring-time="">
      <label className="cs-time-label" htmlFor="cs-time-scrub">
        Authoring time
      </label>
      <input
        id="cs-time-scrub"
        type="range"
        className="cs-time-scrub"
        min={0}
        max={slide.durationMs}
        step={100}
        value={session.authoringTime}
        aria-valuetext={`${seconds(session.authoringTime)} of ${seconds(slide.durationMs)} seconds`}
        onChange={(event) => session.setAuthoringTime(Number(event.target.value))}
      />
      <output className="cs-time-value" htmlFor="cs-time-scrub">
        {`${seconds(session.authoringTime)}s`}
      </output>
    </div>
  )
}
