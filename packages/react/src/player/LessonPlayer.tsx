import type { ReactNode } from 'react'
import type { LessonManifest } from '@cuestack/schema'
import { resolve } from '@cuestack/core'
import { builtinRenderers } from '../elements/builtin/index.js'
import { createRendererRegistry, type ElementRendererRegistry } from '../elements/registry.js'
import type { ThemeValues } from '../theme/tokens.js'
import { SlideView } from './SlideView.js'
import { Stage } from './Stage.js'

export interface LessonPlayerProps {
  readonly lesson: LessonManifest
  readonly slideIndex?: number
  readonly elements?: ElementRendererRegistry
  readonly theme?: ThemeValues
}

const DEFAULT_RENDERERS = createRendererRegistry(builtinRenderers)

/**
 * The component a host renders.
 *
 * This is the render path both the server and the client's first pass take, and it
 * resolves at **time zero** — no clock, no effects, no subscriptions. That is what
 * makes hydration match by construction rather than by care: the client's first render
 * cannot differ from the server's, because it is the same pure call with the same
 * argument (research R-03).
 *
 * Playback is added by the client entry, in an effect after mount.
 */
export function LessonPlayer({
  lesson,
  slideIndex = 0,
  elements = DEFAULT_RENDERERS,
  theme,
}: LessonPlayerProps): ReactNode {
  const slide = lesson.slides[slideIndex]
  if (!slide) return null

  const state = resolve(slide, 0)

  return (
    <Stage lesson={lesson} {...(theme ? { theme } : {})}>
      <SlideView state={state} renderers={elements} />
    </Stage>
  )
}
