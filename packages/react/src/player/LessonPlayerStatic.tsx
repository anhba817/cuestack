import type { ReactNode } from 'react'
import type { LessonManifest } from '@cuestack/schema'
import { resolve } from '@cuestack/core'
import { builtinRenderers } from '../elements/builtin/index.js'
import { createRendererRegistry, type ElementRendererRegistry } from '../elements/registry.js'
import type { AssetResolver } from '../elements/assets.js'
import type { ThemeValues } from '../theme/tokens.js'
import { SlideView } from './SlideView.js'
import { Stage } from './Stage.js'

export interface LessonPlayerStaticProps {
  readonly lesson: LessonManifest
  readonly slideIndex?: number
  readonly elements?: ElementRendererRegistry
  readonly theme?: ThemeValues
  /** How to address an asset. See `elements/assets.ts` — the manifest carries opaque ids,
   *  so a host that hosts its assets anywhere but at those paths must supply this. */
  readonly resolveAsset?: AssetResolver
}

const DEFAULT_RENDERERS = createRendererRegistry(builtinRenderers)

/**
 * The server-rendered first frame. **No hooks**, deliberately.
 *
 * This is what the `react-server` condition resolves, and the constraint is not
 * stylistic: a component that touches `useState` or `createContext` cannot be a React
 * Server Component at all, so the playing player is structurally unable to render on a
 * server. Discovering that meant splitting one component into two — which is what the
 * contract described all along, and what "both entries export the same name with
 * different implementations" actually requires.
 *
 * Resolves at time zero and stops there. A learner with no JavaScript sees exactly this.
 */
export function LessonPlayerStatic({
  lesson,
  slideIndex = 0,
  elements = DEFAULT_RENDERERS,
  theme,
  resolveAsset,
}: LessonPlayerStaticProps): ReactNode {
  const slide = lesson.slides[slideIndex]
  if (!slide) return null

  return (
    <Stage lesson={lesson} {...(theme ? { theme } : {})}>
      <SlideView
        state={resolve(slide, 0)}
        renderers={elements}
        {...(resolveAsset ? { resolveAsset } : {})}
      />
    </Stage>
  )
}
