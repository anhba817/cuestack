import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { LessonEvent } from '@cuestack/core'
import type { Interaction, LessonManifest } from '@cuestack/schema'
import {
  createAdvanceController,
  createMediaLink,
  createTransport,
  MEDIA_SYNC_TOLERANCE_MS,
  resolve,
  type Ports,
  type BlockingProblem,
  type MediaLinkController,
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
import { createDomMediaPort } from '../media/domMediaPort.js'
import { GesturePrompt, hasAudibleMedia } from './GesturePrompt.js'
import { useInteractions } from './useInteractions.js'
import { PlayerContext } from './usePlayer.js'
import { SlideTransition, type TransitionType } from './SlideTransition.js'
import { LessonComplete } from './LessonComplete.js'
import { PlaybackProblem } from './PlaybackProblem.js'
import { describeProblem, detectAdapterProblem, detectMediaAttachFailure } from './problems.js'
import { LessonProgress } from './LessonProgress.js'

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
   * Whether to show lesson progress.
   *
   * A **host** option, not a manifest field. FR-PLY-013 says "where enabled by the teacher or
   * organization"; the format carries no such field, adding one is a migration, and the
   * organisation half is BR-012 in Wave 5. A host option satisfies the requirement now
   * without freezing a format decision early — and a host that already knows its policy is
   * the right place to hold it.
   *
   * Not a boolean, so a third option later — time-based, chapters — is not a breaking change.
   */
  readonly progress?: 'none' | 'slides'
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

interface Leaving {
  readonly state: RenderState
  readonly type: TransitionType
  readonly durationMs: number
  /** Lesson time on the incoming slide at which the transition is over. */
  readonly untilMs: number
  /**
   * The slide it is entering.
   *
   * Needed because `untilMs` is on that slide's clock, and navigating elsewhere resets the
   * clock to zero — leaving the comparison permanently unsatisfied and two slides on screen
   * forever. Arriving at a different slide ends the transition outright, whatever the time
   * says.
   */
  readonly toIndex: number
}

/** The transition authored on the slide being *entered*, or none. */
function transitionOf(
  lesson: LessonManifest,
  slideIndex: number,
): { type: TransitionType; durationMs: number } {
  const authored = lesson.slides[slideIndex]?.transition
  return {
    type: (authored?.type ?? 'none') as TransitionType,
    durationMs: authored?.durationMs ?? 0,
  }
}

/**
 * When an element begins, in slide time.
 *
 * A media element authored to start two seconds in is at position zero when slide time
 * reaches two seconds. Seeking the lesson without subtracting this would put every delayed
 * video that far ahead of where it belongs.
 */
function startOf(lesson: LessonManifest, slideIndex: number, elementId: string): number {
  const element = lesson.slides[slideIndex]?.elements.find((e) => e.id === elementId)
  return element?.startMs ?? 0
}

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
  progress = 'none',
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

  const stepRef = useRef<((snapshot: TransportSnapshot) => void) | null>(null)
  const mediaRef = useRef<MediaLinkController | null>(null)
  const gestureGivenRef = useRef(false)
  const transportRef = useRef<Transport | null>(null)

  /**
   * The gesture latch (BR-014). One per lesson: the requirement says "an initial user
   * action", and asking again on every slide with sound is the behaviour learners resent
   * from the browsers that do it.
   *
   * Starts satisfied unless autoplay was requested *and* the lesson has audible media —
   * pressing play is itself a gesture, so a learner who starts manually never sees a prompt.
   */
  const needsGesture = autoPlay && hasAudibleMedia(lesson)
  const [gestureGiven, setGestureGiven] = useState(!needsGesture)
  gestureGivenRef.current = gestureGiven

  /**
   * Back into the lesson from the completion state (FR-022).
   *
   * Returns to the first slide and plays. Trapping a learner at the end so they must reload
   * to review is worse than having no end state at all.
   */
  const review = useCallback(() => {
    setComplete(false)
    transportRef.current?.goToSlide(0)
    transportRef.current?.play()
  }, [])

  /** The learner's action. Starts playback and is never asked for again (FR-015). */
  const givePermission = useCallback(() => {
    gestureGivenRef.current = true
    setGestureGiven(true)
    transportRef.current?.play()
  }, [])
  /** Set by the mount effect; read by the frame loop. A ref because the loop must not be
   *  rebuilt each render, and the step closes over the effect's transport and controller. */

  const resolveAt = useCallback(
    (slideTimeMs: number): RenderState => resolve(slide!, slideTimeMs),
    [slide],
  )

  // Time zero, always, for the render both the server and the client's first pass take.
  const initial = useMemo(() => (slide ? resolve(slide, 0) : null), [slide])

  const latest = useRef<RenderState | null>(initial)
  const state = visibleIds === '' ? initial : latest.current

  /**
   * The slide leaving, while a transition runs.
   *
   * Held as state because it is structural — React must render a second stage — and cleared
   * on a timer rather than per frame, since the animation itself is CSS and needs no
   * per-frame involvement from React.
   */
  /** Slides reached, so seeking backwards does not un-earn progress already made. */
  const [visited, setVisited] = useState<ReadonlySet<number>>(() => new Set([slideIndex]))
  const [complete, setComplete] = useState(false)
  /** Bumped to make the renderers ask for their assets again, without restarting anything. */
  const [retryToken, setRetryToken] = useState(0)
  /**
   * Why the lesson cannot continue, from the advance controller.
   *
   * Separate from `RenderState.blocked` because the kernel splits the detections: `resolve`
   * knows about an unrenderable required interaction, while whether an advance *rule* can
   * ever be satisfied is the controller's question and needs the media port to answer. Two
   * detections, one presentation.
   */
  const [unreachable, setUnreachable] = useState<BlockingProblem | null>(null)
  const [leaving, setLeaving] = useState<Leaving | null>(null)
  /** Read by the frame loop, which does not re-render and cannot see React state. */
  const leavingRef = useRef<Leaving | null>(null)
  leavingRef.current = leaving

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
    /**
     * The DOM media port is built here, over the frame writer's node registry, so the link
     * can find a slide's `<video>` without any renderer holding a ref — video and audio
     * render on the server path, where a ref is not allowed.
     *
     * A caller-supplied `ports` wins outright: a test handing in a scripted media fake must
     * not have it replaced by one reading a DOM that has no decoder behind it.
     */
    const activePorts: Ports = ports ?? {
      ...browserPorts(),
      media: createDomMediaPort({ nodeFor: (id) => writer.nodeFor(id) }),
    }
    const t = createTransport(lesson, activePorts)
    const advance = createAdvanceController(activePorts)
    const media = createMediaLink(activePorts.media)
    setTransport(t)
    transportRef.current = t
    onReady?.(t)

    analytics.current = (e: LessonEvent) => activePorts.analytics.record(e)
    activePorts.analytics.record(event(lesson, 'lesson_started'))
    let announced = -1
    let completed = false
    /** Lesson time at which the completion set last grew, or null if it has not. */
    let completedAtMs: number | null = null
    let seenCompletions = 0
    /** The blocking code last handed to React, so an unchanged one costs no render. */
    let reportedCode: BlockingProblem['code'] | null = null

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
        /**
         * Capture the outgoing slide here, where it still exists.
         *
         * A first version read it during render, from the ref — by which point `step` had
         * already overwritten it with the *incoming* slide's state, so the transition
         * rendered the same slide twice. The old state is only in hand for the moment
         * between one `resolve` and the next, and this is that moment.
         *
         * `type: 'none'` and `durationMs: 0` are both authorable and both mean "change
         * immediately"; rendering two stages for either would leave a frame of doubled
         * content.
         */
        const authored = transitionOf(lesson, snapshot.slideIndex)
        const previous = latest.current
        if (announced !== -1 && previous && authored.durationMs > 0 && authored.type !== 'none') {
          // `untilMs` is on the *incoming* slide's clock, which starts at zero.
          const next: Leaving = {
            state: previous,
            type: authored.type,
            durationMs: authored.durationMs,
            untilMs: snapshot.slideTimeMs + authored.durationMs,
            toIndex: snapshot.slideIndex,
          }
          leavingRef.current = next
          setLeaving(next)
        }
        announced = snapshot.slideIndex
        setVisited((seen) => (seen.has(snapshot.slideIndex) ? seen : new Set([...seen, snapshot.slideIndex])))
        activePorts.analytics.record(event(lesson, 'slide_started', active.id))
      }

      /**
       * End the transition on **lesson** time, not wall-clock.
       *
       * A first version used `setTimeout`, which made a paused lesson finish its crossfade
       * while everything else was frozen — and made the behaviour untestable without waiting
       * out real durations, which Constitution II forbids. Lesson time is the clock
       * everything else in the player runs on, and a transition is part of the lesson.
       *
       * It also gives US3 #8 for free: a seek past the transition's end settles it, because
       * the new slide's time is already beyond it.
       */
      const outgoing = leavingRef.current
      if (
        outgoing &&
        (snapshot.slideIndex !== outgoing.toIndex || snapshot.slideTimeMs >= outgoing.untilMs)
      ) {
        leavingRef.current = null
        setLeaving(null)
      }

      /**
       * Ask whether this slide's advance rule can ever be satisfied.
       *
       * Per tick rather than once per slide: media can fail at any moment, and a question
       * becomes unsatisfiable at the instant its last attempt is spent. A one-off check at
       * slide entry would report the world as it was when the learner arrived.
       *
       * Compared **by code**, not by identity. `reachability` builds a fresh object each
       * call, so setting state unconditionally re-rendered React on every frame — the exact
       * per-frame reconciliation the frame loop exists to avoid, and enough to hang a test.
       */
      const next = resolve(active, snapshot.slideTimeMs)
      latest.current = next

      /**
       * Then the one blocking condition that needs a clock, which is why it is asked here
       * and not where the player renders: the player does not re-render as time passes, so
       * a render-time `slideTimeMs` is whatever it was at the last commit — zero, forever,
       * on exactly the stalled slide this exists to catch.
       */
      const reach =
        advance.reachability(active, activePorts.media) ??
        detectMediaAttachFailure(next, active, activePorts.media, snapshot.slideTimeMs)
      if ((reach?.code ?? null) !== reportedCode) {
        reportedCode = reach?.code ?? null
        setUnreachable(reach)
      }
      setCurrentIndex(snapshot.slideIndex)

      // Register this slide's media so the link has something to pause and command. The
      // port answers about ids you name and cannot enumerate, so nothing else would tell it.
      for (const element of next.elements) {
        if (element.type === 'video' || element.type === 'audio') media.attach(element.id)
      }
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
        setComplete(true)
        activePorts.analytics.record(event(lesson, 'lesson_completed', active.id))
      }
    }

    stepRef.current = step
    const unsubscribe = t.subscribe(step)

    /**
     * The lesson commands its media, and follows it when the learner moves it directly.
     * Both directions run through `reconcile`, which is the one place that decides which
     * clock wins (FR-037).
     */
    mediaRef.current = media
    const unfollow = media.subscribe((_elementId, positionMs) => t.seek(positionMs))

    /**
     * Pause and resume media with the lesson, and take it along when the lesson seeks.
     *
     * The transport emits on *command* — play, pause, seek, goToSlide — and never on a
     * timer, so this fires exactly when the lesson's position changed for a reason other
     * than time passing. That is the moment media has to be told.
     *
     * Which elements to move, and by how much, comes from the resolved state: an element
     * that starts at 2 s into the slide is at position zero when slide time is 2 s. Seeking
     * the lesson to 5 s must put it at 3 s, not 5 s.
     *
     * The command is issued only when the media is more than a tolerance away. Without that
     * guard this would re-command on the emission caused by the lesson *following* a
     * learner's scrub, which is the loop under a different name.
     */
    const unwatch = t.subscribe((snapshot: TransportSnapshot) => {
      if (snapshot.state === 'playing') media.resumeAll()
      else media.pauseAll()

      for (const element of latest.current?.elements ?? []) {
        if (element.type !== 'video' && element.type !== 'audio') continue
        const wanted = Math.max(0, snapshot.slideTimeMs - startOf(lesson, snapshot.slideIndex, element.id))
        const at = media.statusOf(element.id)?.positionMs
        if (at === undefined || Math.abs(at - wanted) <= MEDIA_SYNC_TOLERANCE_MS) continue
        media.seek(element.id, wanted)
      }
    })

    if (autoPlay && (!needsGesture || gestureGivenRef.current)) t.play()

    return () => {
      stepRef.current = null
      analytics.current = null
      mediaRef.current = null
      transportRef.current = null
      unfollow()
      unwatch()
      unsubscribe()
      media.dispose()
      writer.clear()
    }
  }, [lesson, ports, autoPlay, onReady, writer, needsGesture])

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

  /**
   * What the learner is shown when the lesson cannot continue.
   *
   * Derived from `RenderState.blocked` — and deliberately **not** from `RenderState.problems`.
   * A `RenderProblem` like `EFFECT_BEYOND_SLIDE` is a note to an author about a lesson the
   * learner cannot fix, and showing it would breach FR-024 and NFR-USA-004 at once: a
   * learner can take no action on it. A `BlockingProblem` is the opposite — they are stuck,
   * and they are the only person who can be told.
   */
  /**
   * The first blocking condition from any of the three detections, described once.
   *
   * Order is deliberate: the kernel's own answer first, then the advance rule's reachability,
   * then what only this adapter can see. A learner is shown one problem — the most
   * fundamental — rather than a list they have to triage.
   */
  const blocking =
    state.blocked ??
    unreachable ??
    detectAdapterProblem(state, elements, interactions.state)
  const blocked = blocking ? describeProblem(blocking) : null
  const canSkip = currentIndex + 1 < lesson.slides.length

  const content = (
    <SlideTransition
      lesson={lesson}
      incoming={state}
      outgoing={leaving?.state ?? null}
      type={leaving?.type ?? 'none'}
      durationMs={leaving?.durationMs ?? 0}
      renderers={elements}
      writer={writer}
      interactionFor={interactionFor}
      retryToken={retryToken}
      {...(theme ? { theme } : {})}
      {...(resolveAsset ? { resolveAsset } : {})}
    />
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
      {/* Before the gesture, in place of the controls: audible media has not been permitted
          to start, and offering transport controls that cannot honour a press is worse than
          asking plainly. */}
      {progress === 'slides' ? (
        <LessonProgress
          slideIndex={currentIndex}
          slideCount={lesson.slides.length}
          visited={visited}
        />
      ) : null}
      {blocked ? (
        <PlaybackProblem
          problem={blocked}
          canSkip={canSkip}
          onRetry={() => setRetryToken((n) => n + 1)}
          onSkip={() => transportRef.current?.goToSlide(currentIndex + 1)}
        />
      ) : null}
      {complete ? (
        <LessonComplete title={lesson.lesson.title} onReview={review} />
      ) : gestureGiven ? (
        children
      ) : (
        <GesturePrompt onStart={givePermission} />
      )}
    </PlayerContext.Provider>
  )
}
