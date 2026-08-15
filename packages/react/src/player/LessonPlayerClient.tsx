import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { LessonEvent } from '@cuestack/core'
import type { LessonManifest } from '@cuestack/schema'
import {
  createAdvanceController,
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

/** One shared empty set rather than a new one per tick — the controller only reads it. */
const EMPTY_COMPLETIONS: ReadonlySet<string> = new Set()

/**
 * A lesson event, carrying no learner identifier of any kind.
 *
 * NFR-PRV-002 keeps identifiers out of the manifest; FR-006 keeps them out of what the
 * player emits. A host that wants attribution correlates on its own side, from its own
 * session, and the framework never sees it.
 */
function event(lesson: LessonManifest, kind: LessonEvent['kind'], slideId?: string): LessonEvent {
  return {
    kind,
    lessonId: lesson.lesson.id,
    schemaVersion: lesson.schemaVersion,
    ...(slideId === undefined ? {} : { slideId }),
  }
}

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
  /**
   * Which slide is showing.
   *
   * State, seeded from the prop — the prop is where a host deep-links, not a permanent
   * assignment. Through all of Wave 2 it was a fixed prop and nothing ever changed it, so
   * the lesson could not move from one slide to the next; no test noticed, because every
   * player test rendered one slide (research R-04).
   *
   * The transport remains authoritative: this follows `snapshot.slideIndex` rather than
   * being set alongside it, so there is one answer to "which slide" and not two.
   */
  const [currentIndex, setCurrentIndex] = useState(slideIndex)
  const slide = lesson.slides[currentIndex]

  /**
   * Which elements are visible. Held in state because that is structural — React must
   * re-render when it changes. Continuous values (opacity, transform) are NOT here:
   * the frame writer applies those directly, so sixty updates a second cost no
   * reconciliation (plan.md Complexity Tracking row 1).
   */
  const [visibleIds, setVisibleIds] = useState<string>('')
  const [transport, setTransport] = useState<Transport | null>(null)
  const writer = useMemo(() => createFrameWriter(), [])
  /** Set by the mount effect; read by the frame loop. A ref because the loop must not be
   *  rebuilt each render, and the step closes over the effect's transport and controller. */
  const stepRef = useRef<((snapshot: TransportSnapshot) => void) | null>(null)

  const resolveAt = useCallback(
    (slideTimeMs: number): RenderState => resolve(slide!, slideTimeMs),
    [slide],
  )

  // Time zero, always, for the render both the server and the client's first pass take.
  const initial = useMemo(() => (slide ? resolve(slide, 0) : null), [slide])

  const latest = useRef<RenderState | null>(initial)
  const state = visibleIds === '' ? initial : latest.current

  /** Reset the fallback when the slide changes, so a new slide starts at its own time zero
   *  rather than showing the previous slide's last frame. */
  const shownIndex = useRef(currentIndex)
  if (shownIndex.current !== currentIndex) {
    shownIndex.current = currentIndex
    latest.current = initial
  }

  useEffect(() => {
    if (lesson.slides.length === 0) return
    // Constructed here, never during render: browserPorts() reads document and performance.
    const activePorts = ports ?? browserPorts()
    const t = createTransport(lesson, activePorts)
    const advance = createAdvanceController(activePorts)
    setTransport(t)
    onReady?.(t)

    activePorts.analytics.record(event(lesson, 'lesson_started'))
    let announced = -1
    let completed = false

    /**
     * One step of the lesson, whatever caused it.
     *
     * Called from the frame loop as time passes, and from the transport's subscription when
     * something commands a change. Both routes have to do the same work — a seek that
     * updated the screen differently from playing to the same moment is the parity
     * divergence Principle V forbids — so there is one function and two callers.
     */
    const step = (snapshot: TransportSnapshot): void => {
      const active = lesson.slides[snapshot.slideIndex]
      if (!active) return

      if (announced !== snapshot.slideIndex) {
        announced = snapshot.slideIndex
        activePorts.analytics.record(event(lesson, 'slide_started', active.id))
      }

      const next = resolve(active, snapshot.slideTimeMs)
      latest.current = next
      setCurrentIndex(snapshot.slideIndex)
      // Re-render only when the *set* of visible elements changes.
      setVisibleIds(next.elements.map((e) => e.id).join(',') || 'none')

      /**
       * Ask, then apply. The controller decides *whether*; the transport does the moving.
       * Wave 1 split them for exactly this — the decision is testable with no transport,
       * and single-fire (BR-007) is the controller's business, keyed on slide instance so
       * a replayed slide can advance again while a repeated condition cannot.
       */
      const decision = advance.evaluate(active, snapshot, {
        learnerAdvanced: false,
        // US1 replaces this with the learner's real completions (T032). Until then a
        // required question cannot complete, which is why one holds the slide already.
        completedInteractions: EMPTY_COMPLETIONS,
      })
      if (!decision) return

      activePorts.analytics.record(event(lesson, 'slide_completed', active.id))
      const following = snapshot.slideIndex + 1
      if (following < lesson.slides.length) {
        t.goToSlide(following)
      } else if (!completed) {
        completed = true
        activePorts.analytics.record(event(lesson, 'lesson_completed', active.id))
      }
    }

    stepRef.current = step
    const unsubscribe = t.subscribe(step)

    if (autoPlay) t.play()

    return () => {
      stepRef.current = null
      unsubscribe()
      writer.clear()
    }
  }, [lesson, ports, autoPlay, onReady, writer])

  /**
   * The frame loop is the only thing that runs as time passes — the transport emits on
   * command, not on a timer. Without this the lesson would never advance and no element
   * would ever appear mid-slide, which is what Wave 2 shipped.
   */
  const onFrame = useCallback(
    (_state: RenderState, slideTimeMs: number) => {
      const t = transport
      if (!t) return
      stepRef.current?.({
        state: t.state,
        slideIndex: t.slideIndex,
        slideTimeMs,
        instanceId: t.instanceId,
      })
    },
    [transport],
  )

  useFrameLoop(transport, writer, resolveAt, onFrame)

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

  /*
   * The provider is always present, even before the transport exists.
   *
   * Providing it conditionally meant `usePlayer()` threw for every child on its first
   * render — the documented way for a host to drive playback, unusable by a host. The
   * transport is nullable instead, which is what it genuinely is during a server render and
   * during the hydration pass, and callers check it.
   */
  return (
    <PlayerContext.Provider value={{ transport, slideDurationMs: slide.durationMs }}>
      {content}
      {children}
    </PlayerContext.Provider>
  )
}
