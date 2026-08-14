import type { ReactNode } from 'react'
import type { LessonManifest } from '@cuestack/schema'
import { stageProperties, type ThemeValues } from '../theme/tokens.js'

export interface StageProps {
  readonly lesson: LessonManifest
  readonly theme?: ThemeValues
  readonly children: ReactNode
}

/**
 * The scaled surface.
 *
 * Establishes the container that every dimension beneath it resolves against, and
 * sets the canvas and theme properties the stylesheet reads. It measures nothing:
 * `container-type: size` lets the browser do the work during layout, which is the
 * only reason the server can emit correct geometry.
 */
export function Stage({ lesson, theme, children }: StageProps): ReactNode {
  return (
    <div
      className="cs-stage"
      style={stageProperties(lesson, theme) as React.CSSProperties}
      data-cs-aspect={lesson.lesson.aspectRatio}
      lang={lesson.lesson.language}
    >
      {children}
    </div>
  )
}
