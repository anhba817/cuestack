'use client'

import { useEffect, useReducer, type ReactNode } from 'react'
import { PlaybackControls, usePlayer } from '@cuestack/react'

export interface PreviewControlsProps {
  /**
   * How many slides the lesson has.
   *
   * From the same manifest the player was given, rather than from the transport, which does
   * not report it. Not a second source: one object, read twice.
   */
  readonly slideCount: number
}

/**
 * Play, pause, seek, previous, next — the controls that mean something only while the lesson
 * is playing.
 *
 * **The inside half of the split.** This renders as the player's `children`, so it may use
 * `usePlayer`, and the prop's own comment is right about why these belong here: a host
 * holding its own transport would be a second idea of the current time.
 *
 * **Close and restart do not live here.** Both must be reachable at the completion state,
 * where `children` is replaced by the lesson's own ending — so both belong to the frame.
 * Restart is the one that makes the rule worth stating: it needs the transport, so a rule
 * about transport access would have put it in the half that disappears.
 *
 * Previous and next are `transport.goToSlide`, which has existed since Wave 3. What this
 * writes is the arrangement and the boundary states: `goToSlide` past the last index sets the
 * transport to `completed`, so next must be *unavailable* at the end rather than calling it
 * and finding out.
 *
 * They deliberately keep the learner's answers. `goToSlide` bumps the slide's visit count, so
 * the advance controller re-decides it while the answers persist — which is exactly what a
 * learner moving within one run experiences. Only restart is a fresh run.
 */
export function PreviewControls({ slideCount }: PreviewControlsProps): ReactNode {
  const { transport } = usePlayer()
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => transport?.subscribe(() => force()), [transport])
  if (!transport) return null

  const index = transport.slideIndex
  const last = index + 1 >= slideCount
  const first = index === 0

  return (
    <div className="cs-preview-controls">
      <PlaybackControls />
      <button
        type="button"
        data-cs-preview-previous
        disabled={first}
        aria-disabled={first}
        title={first ? 'This is the first slide' : 'Previous slide'}
        onClick={() => transport.goToSlide(index - 1)}
      >
        Previous slide
      </button>
      <button
        type="button"
        data-cs-preview-next
        disabled={last}
        aria-disabled={last}
        title={last ? 'This is the last slide' : 'Next slide'}
        onClick={() => transport.goToSlide(index + 1)}
      >
        Next slide
      </button>
      {first || last ? (
        <p className="cs-preview-bound" role="status">
          {first && last
            ? 'This lesson has one slide, so there is nothing before or after it.'
            : first
              ? 'This is the first slide, so there is nothing before it.'
              : 'This is the last slide, so there is nothing after it.'}
        </p>
      ) : null}
    </div>
  )
}

