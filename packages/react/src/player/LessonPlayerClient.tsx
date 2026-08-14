import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { LessonManifest } from '@cuestack/schema'
import {
  createTransport,
  resolve,
  type Ports,
  type RenderState,
  type Transport,
  type TransportSnapshot,
} from '@cuestack/core'
import { builtinRenderers } from '../elements/builtin/index.js'
import { createRendererRegistry, type ElementRendererRegistry } from '../elements/registry.js'
import type { AssetResolver } from '../elements/assets.js'
import type { ThemeValues } from '../theme/tokens.js'
import { createFrameWriter } from '../frame/FrameWriter.js'
import { useFrameLoop } from '../frame/useFrameLoop.js'
import { browserPorts } from './browserPorts.js'
import { PlayerContext } from './usePlayer.js'
import { SlideView } from './SlideView.js'
import { Stage } from './Stage.js'

export interface LessonPlayerClientProps {
  readonly lesson: LessonManifest
  readonly slideIndex?: number
  readonly elements?: ElementRendererRegistry
  readonly theme?: ThemeValues
  /** How to address an asset. See `elements/assets.ts`. */
  readonly resolveAsset?: AssetResolver
  /**
   * Not in the original data model, and needed: the transport requires a time source,
   * and feature 002's FR-015 requires that source to be substitutable. Tests supply a
   * hand-advanced clock. Without this the player would be untestable without waiting in
   * real time.
   *
   * Defaults to real browser ports, constructed inside the mount effect. It was optional
   * with no default at first, and the effect returned early without it — so a host writing
   * `<LessonPlayer lesson={lesson} autoPlay />` got a static first frame and nothing more,
   * permanently. Every playback test passed `ports`, so the only path a real host takes was
   * the only path untested.
   */
  readonly ports?: Ports
  readonly autoPlay?: boolean
  /**
   * Chrome the host places inside the player — `<PlaybackControls />` above all.
   *
   * Inside rather than beside, because controls need the transport and the transport must
   * stay singular: a host holding its own would be a second idea of the current time. It
   * renders outside the stage, since controls are chrome and not composed slide content.
   */
  readonly children?: ReactNode
  readonly onReady?: (transport: Transport) => void
}

const DEFAULT_RENDERERS = createRendererRegistry(builtinRenderers)

/**
 * The playing player. **Client only** — it uses hooks, so it cannot be a Server
 * Component.
 *
 * Its first render resolves at time zero, identical to what LessonPlayerStatic emits on
 * the server. Playback starts in an effect after mount, never during render, which is
 * what makes hydration match by construction rather than by care: the client's first
 * pass cannot differ from the server's, because it is the same pure call with the same
 * argument (research R-03).
 */
export function LessonPlayerClient({
  lesson,
  slideIndex = 0,
  elements = DEFAULT_RENDERERS,
  theme,
  resolveAsset,
  ports,
  autoPlay = false,
  onReady,
  children,
}: LessonPlayerClientProps): ReactNode {
  const slide = lesson.slides[slideIndex]

  /**
   * Which elements are visible. Held in state because that is structural — React must
   * re-render when it changes. Continuous values (opacity, transform) are NOT here:
   * the frame writer applies those directly, so sixty updates a second cost no
   * reconciliation (plan.md Complexity Tracking row 1).
   */
  const [visibleIds, setVisibleIds] = useState<string>('')
  const [transport, setTransport] = useState<Transport | null>(null)
  const writer = useMemo(() => createFrameWriter(), [])

  const resolveAt = useCallback(
    (slideTimeMs: number): RenderState => resolve(slide!, slideTimeMs),
    [slide],
  )

  // Time zero, always, for the render both the server and the client's first pass take.
  const initial = useMemo(() => (slide ? resolve(slide, 0) : null), [slide])

  const latest = useRef<RenderState | null>(initial)
  const state = visibleIds === '' ? initial : latest.current

  useEffect(() => {
    if (!slide) return
    // Constructed here, never during render: browserPorts() reads document and performance.
    const t = createTransport(lesson, ports ?? browserPorts())
    setTransport(t)
    onReady?.(t)

    const unsubscribe = t.subscribe((snapshot: TransportSnapshot) => {
      const next = resolve(slide, snapshot.slideTimeMs)
      latest.current = next
      // Re-render only when the *set* of visible elements changes.
      setVisibleIds(next.elements.map((e) => e.id).join(',') || 'none')
      writer.write(next)
    })

    if (autoPlay) t.play()

    return () => {
      unsubscribe()
      writer.clear()
    }
  }, [lesson, slide, ports, autoPlay, onReady, writer])

  useFrameLoop(transport, writer, resolveAt)

  if (!slide || !state) return null

  const content = (
    <Stage lesson={lesson} {...(theme ? { theme } : {})}>
      <SlideView
        state={state}
        renderers={elements}
        writer={writer}
        {...(resolveAsset ? { resolveAsset } : {})}
      />
    </Stage>
  )

  return transport ? (
    <PlayerContext.Provider value={{ transport, slideDurationMs: slide.durationMs }}>
      {content}
      {children}
    </PlayerContext.Provider>
  ) : (
    /* Before the mount effect, and on the server: no transport, so no provider. Children
       still render, so non-hook chrome is server-rendered too — PlaybackControls renders
       nothing without a provider, which is what keeps the hydration pass matching. */
    <>
      {content}
      {children}
    </>
  )
}
