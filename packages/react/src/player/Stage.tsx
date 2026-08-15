import type { ReactNode } from 'react'
import type { LessonManifest } from '@cuestack/schema'
import { stageProperties, type ThemeValues } from '../theme/tokens.js'

export interface StageTransition {
  readonly role: 'leaving' | 'entering'
  readonly type: string
  readonly durationMs: number
}

export interface StageProps {
  readonly lesson: LessonManifest
  readonly theme?: ThemeValues
  readonly children: ReactNode
  /**
   * Present only while a slide change is animating.
   *
   * The duration reaches CSS as a custom property, like every other value in this package —
   * so the animation is declarative and the transition is not a re-render per frame.
   */
  readonly transition?: StageTransition
}

/**
 * The scaled surface.
 *
 * Establishes the container that every dimension beneath it resolves against, and
 * sets the canvas and theme properties the stylesheet reads. It measures nothing:
 * `container-type: size` lets the browser do the work during layout, which is the
 * only reason the server can emit correct geometry.
 *
 * The lesson's aspect ratio reaches the page as two numbers — the logical canvas
 * dimensions — and the stylesheet builds `aspect-ratio` from them. Not a class per
 * ratio and not a computed style: a class would need a stylesheet change to support a
 * new ratio, and the canvas numbers are needed anyway, since every element coordinate
 * is relative to them.
 */
export function Stage({ lesson, theme, children, transition }: StageProps): ReactNode {
  const style = {
    ...stageProperties(lesson, theme),
    ...(transition ? { '--cs-transition-ms': String(transition.durationMs) } : {}),
  }

  return (
    <div
      className="cs-stage"
      style={style as React.CSSProperties}
      data-cs-aspect={lesson.lesson.aspectRatio}
      lang={lesson.lesson.language}
      {...(transition
        ? {
            'data-cs-transition': transition.role,
            'data-cs-transition-type': transition.type,
            /* The slide that is leaving is no longer the lesson. A screen reader meeting two
               copies would read the outgoing one first, which is the wrong content and in the
               wrong order. */
            ...(transition.role === 'leaving' ? { 'aria-hidden': true } : {}),
          }
        : {})}
    >
      {children}
    </div>
  )
}
