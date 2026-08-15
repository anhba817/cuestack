import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { LessonEvent } from '@cuestack/core'
import type { Interaction, LessonManifest } from '@cuestack/schema'
import {
  createAdvanceController,
  createTransport,
  resolve,
  type Ports,
  type RenderState,
  type ResolvedElement,
  type Transport,
  type TransportSnapshot,
} from '@cuestack/core'
import { builtinRenderers } from '../elements/builtin/index.js'
import { createRendererRegistry, type ElementRendererRegistry } from '../elements/registry.js'
import type { AssetResolver } from '../elements/assets.js'
import type { InteractionAccess } from '../elements/registry.js'
import type { ThemeValues } from '../theme/tokens.js'
import { createFrameWriter } from '../frame/FrameWriter.js'
import { useFrameLoop } from '../frame/useFrameLoop.js'
import { browserPorts } from './browserPorts.js'
import { useInteractions } from './useInteractions.js'
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
 * How long feedback stays on screen before a completed interaction is allowed to advance
 * the slide.
 *
 * MVP Acceptance Scenario B sequences it explicitly — "Feedback is displayed. The player
 * advances according to the configured policy." Without a pause those are the same instant:
 * a learner who answers *after* the duration has elapsed completes the question on one tick
 * and the pending timer fires on the next, so the verdict is rendered and replaced inside a
 * single frame. It is announced to a screen reader and invisible to everyone, including the
 * screen reader user, since the live region is torn down before it is read.
 *
 * 1.5 seconds, matching the autosave delay the Constitution already fixes at "approximately
 * 1.5 seconds" — so the codebase carries one human-scale interval rather than two arbitrary
 * ones. It applies only to advancement caused by an interaction completing; a slide running
 * out its own duration with nothing to read is unaffected.
 */
const FEEDBACK_DWELL_MS = 1500

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

  /**
   * The learner's answers, and the analytics port they are reported through.
   *
   * The port is read from a ref rather than captured, because `useInteractions` is created
   * during render and the ports are constructed inside the mount effect. Recording an event
   * before the effect has run is impossible in practice — nothing can be answered before
   * mount — but reaching for a port that does not exist yet would be a crash rather than a
   * missing datapoint.
   */
  const analytics = useRef<((e: LessonEvent) => void) | null>(null)
  const recordEvent = useCallback((e: LessonEvent) => analytics.current?.(e), [])
  const interactions = useInteractions(lesson, recordEvent)

  /** Read by the frame loop, which does not re-render and so cannot see React state. */
  const completions = useRef<ReadonlySet<string>>(interactions.completedIds)
  completions.current = interactions.completedIds
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

    analytics.current = (e: LessonEvent) => activePorts.analytics.record(e)
    activePorts.analytics.record(event(lesson, 'lesson_started'))
    let announced = -1
    let completed = false
    /** Lesson time at which the completion set last grew, or null if it has not. */
    let completedAtMs: number | null = null
    let seenCompletions = 0

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
      // Note when an interaction completes, so feedback can be read before the slide moves.
      if (completions.current.size !== seenCompletions) {
        seenCompletions = completions.current.size
        completedAtMs = snapshot.slideTimeMs
      }

      /**
       * Hold briefly so the verdict is readable, **before asking** rather than after.
       *
       * `evaluate` records that a slide instance has fired, so a decision taken and then
       * discarded spends the single-fire budget (BR-007) and the slide can never advance
       * again. A first attempt checked the dwell after evaluating and stalled the lesson
       * permanently — the guard doing exactly its job, on a decision that should never have
       * been requested.
       *
       * Applies only when an answer is what unblocked the slide. A duration running out on
       * its own has nothing to read.
       */
      if (completedAtMs !== null && snapshot.slideTimeMs - completedAtMs < FEEDBACK_DWELL_MS) return

      const decision = advance.evaluate(active, snapshot, {
        learnerAdvanced: false,
        // The learner's actual completions, under each question's authored policy. Wave 1
        // built this gate and passed it an empty set for two waves; this is what fills it.
        completedInteractions: completions.current,
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
      analytics.current = null
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

  /**
   * Interaction access, for question elements only.
   *
   * Built per render rather than memoised per element: the outcome changes whenever an
   * answer lands, and a memo keyed on the element would hand a renderer a stale one. The
   * cost is an object per question per render, and React only re-renders when the visible
   * set changes — not per frame.
   */
  const interactionFor = (resolved: ResolvedElement): InteractionAccess | undefined => {
    if (resolved.type !== 'question') return undefined
    const definition = resolved.payload as Interaction
    return {
      outcome: interactions.state.outcomeOf(resolved.id, definition),
      responses: interactions.state.responses.get(resolved.id) ?? [],
      submit: (selected) =>
        interactions.submit(resolved.id, definition, selected, transport?.slideTimeMs ?? 0),
    }
  }

  const content = (
    <Stage lesson={lesson} {...(theme ? { theme } : {})}>
      <SlideView
        state={state}
        renderers={elements}
        writer={writer}
        interactionFor={interactionFor}
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
