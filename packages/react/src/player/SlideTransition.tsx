import type { ReactNode } from 'react'
import type { RenderState } from '@cuestack/core'
import type { LessonManifest } from '@cuestack/schema'
import type { ElementRendererRegistry, InteractionAccess } from '../elements/registry.js'
import type { AssetResolver } from '../elements/assets.js'
import type { FrameWriter } from '../frame/FrameWriter.js'
import type { ThemeValues } from '../theme/tokens.js'
import type { ResolvedElement } from '@cuestack/core'
import { SlideView } from './SlideView.js'
import { Stage } from './Stage.js'

export type TransitionType = 'none' | 'fade' | 'slide' | 'zoom'

export interface SlideTransitionProps {
  readonly lesson: LessonManifest
  /** The slide arriving. Always present. */
  readonly incoming: RenderState
  /** The slide leaving, while a transition is running. Null the rest of the time. */
  readonly outgoing: RenderState | null
  readonly type: TransitionType
  readonly durationMs: number
  readonly renderers: ElementRendererRegistry
  readonly writer?: FrameWriter
  readonly theme?: ThemeValues
  readonly resolveAsset?: AssetResolver
  readonly interactionFor?: (element: ResolvedElement) => InteractionAccess | undefined
}

/**
 * Two slides on screen, one leaving.
 *
 * There is no way to express a transition with one slide, so this renders both — each from
 * its **own** `RenderState`, resolved at its own slide time by the player. An outgoing slide
 * frozen at the moment the transition began would stop any effect still running on it
 * part-way through, which is visible and wrong.
 *
 * The animation is CSS, driven by a duration custom property and a type attribute. A
 * transition stepped by React state would be a re-render per frame, which is the cost the
 * frame loop was kept out of React to avoid — and it would make the transition the one part
 * of playback that reconciles sixty times a second.
 *
 * **Only the outgoing stage is hidden from assistive technology.** Both are on screen, and a
 * screen reader encountering two copies of a lesson would read the old one first. The
 * incoming slide is the lesson now.
 */
export function SlideTransition({
  lesson,
  incoming,
  outgoing,
  type,
  durationMs,
  renderers,
  writer,
  theme,
  resolveAsset,
  interactionFor,
}: SlideTransitionProps): ReactNode {
  const view = (state: RenderState, live: boolean): ReactNode => (
    <SlideView
      state={state}
      renderers={renderers}
      // Only the live slide registers with the frame writer. The outgoing one is leaving and
      // its elements are about to be unmounted; registering them would have the writer
      // addressing nodes that vanish mid-frame.
      {...(live && writer ? { writer } : {})}
      {...(resolveAsset ? { resolveAsset } : {})}
      {...(live && interactionFor ? { interactionFor } : {})}
    />
  )

  if (!outgoing) {
    return (
      <Stage lesson={lesson} {...(theme ? { theme } : {})}>
        {view(incoming, true)}
      </Stage>
    )
  }

  return (
    <div className="cs-transition" data-cs-transition-type={type}>
      <Stage
        lesson={lesson}
        {...(theme ? { theme } : {})}
        transition={{ role: 'leaving', type, durationMs }}
      >
        {view(outgoing, false)}
      </Stage>
      <Stage
        lesson={lesson}
        {...(theme ? { theme } : {})}
        transition={{ role: 'entering', type, durationMs }}
      >
        {view(incoming, true)}
      </Stage>
    </div>
  )
}
