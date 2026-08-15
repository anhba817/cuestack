'use client'

import type { ReactNode } from 'react'

export interface GesturePromptProps {
  readonly onStart: () => void
}

/**
 * BR-014 / FR-PLY-007: audible media needs a learner action before it plays.
 *
 * **One latch per lesson, not per element and not per slide.** The requirement says "an
 * initial user action", and per-element would ask again on every slide with sound — the
 * behaviour learners already resent from the browsers that do it. Browsers grant autoplay
 * permission at document scope anyway, so a second prompt asks for something already given.
 *
 * Pressing play *is* a gesture, so a learner who starts manually never sees this. It appears
 * only where `autoPlay` was requested and the lesson contains audible media.
 *
 * A real `<button>`, announced, and naming the action rather than describing the state —
 * "Start the lesson" tells a learner what pressing it does; "Audio blocked" tells them about
 * the browser.
 */
export function GesturePrompt({ onStart }: GesturePromptProps): ReactNode {
  return (
    <div className="cs-gesture" role="group" aria-label="Start playback">
      <p className="cs-gesture-message">
        This lesson plays sound. Choose start when you are ready.
      </p>
      <button className="cs-gesture-button" type="button" onClick={onStart}>
        Start the lesson
      </button>
    </div>
  )
}

/**
 * Whether a lesson contains media that would play with sound.
 *
 * Volume zero is an authored intent to be silent, and a muted video needs no gesture —
 * treating it as though it did would block lessons unnecessarily. Absent volume means the
 * author said nothing, which for media defaults to audible.
 */
export function hasAudibleMedia(lesson: {
  readonly slides: readonly { readonly elements: readonly unknown[] }[]
}): boolean {
  return lesson.slides.some((slide) =>
    slide.elements.some((raw) => {
      const element = raw as { type?: string; payload?: { volume?: number } }
      if (element.type !== 'video' && element.type !== 'audio') return false
      return element.payload?.volume !== 0
    }),
  )
}
