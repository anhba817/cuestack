import type { BlockingProblem, InteractionState, MediaPort, RenderState } from '@cuestack/core'
import type { Slide } from '@cuestack/schema'
import type { Interaction } from '@cuestack/schema'
import type { ElementRendererRegistry } from '../elements/registry.js'

/**
 * A blocking condition, in a learner's terms.
 *
 * One place, because NFR-USA-004 requires a message to state the problem, the affected
 * object, and the recommended action — three things that get shortened to one the moment
 * they are written per call site.
 *
 * **The object is named the way a learner sees it.** "The video on this slide" is an object;
 * `element_briefing_video` is an internal identifier, and FR-024 forbids exposing one. A
 * learner cannot act on an id, and being shown one teaches them the software is talking to
 * somebody else.
 */
export interface PlaybackProblem {
  /** The kernel's code. Used to choose the message; never displayed. */
  readonly code: BlockingProblem['code']
  readonly message: string
  /** What the learner can do about it. */
  readonly action: string
  /** Whether offering a retry can change anything. */
  readonly retryable: boolean
}

const MESSAGES: Record<
  BlockingProblem['code'],
  { message: string; action: string; retryable: boolean }
> = {
  /**
   * Media the slide waits for could not be loaded. Retryable: the network is the usual
   * cause and it is the usual cure.
   */
  ADVANCE_MEDIA_FAILED: {
    message: 'The video or audio on this slide could not be loaded, so the lesson is waiting for it.',
    action: 'Try loading it again, or skip to the next slide.',
    retryable: true,
  },

  /**
   * The slide's advance rule can never be satisfied — most often a required question that
   * must be answered correctly, with no attempts left and no correct answer given.
   *
   * **Not retryable**, and that is the honest answer rather than a defeat. Retrying changes
   * nothing about a condition that is unreachable by construction, and offering a button
   * that cannot help is worse than saying so. This is an authoring mistake reaching a
   * learner; Wave 5's validation engine is where the author is warned first.
   */
  ADVANCE_UNSATISFIABLE: {
    message: 'This slide cannot continue on its own — it is waiting for something that cannot happen.',
    action: 'Skip to the next slide.',
    retryable: false,
  },

  /**
   * A required question this player does not know how to render. The learner cannot answer
   * it, so the gate can never open — and unlike a decorative unknown type, losing it is not
   * an option (FR-027/028's asymmetry).
   */
  UNKNOWN_REQUIRED_INTERACTION: {
    message: 'This slide has a question this player cannot show.',
    action: 'Skip to the next slide.',
    retryable: false,
  },
}

export function describeProblem(problem: BlockingProblem): PlaybackProblem {
  const described = MESSAGES[problem.code]
  return { code: problem.code, ...described }
}

/** Every code the kernel can report has a message. Asserted rather than assumed. */
export const DESCRIBED_CODES = Object.keys(MESSAGES) as BlockingProblem['code'][]

/**
 * Blocking conditions only this adapter can see.
 *
 * Two of the three codes cannot be detected by the kernel from what it is given, and it is
 * worth being precise about why rather than treating this as a gap:
 *
 * - **An unrenderable required interaction.** `resolve` decides this from the *kernel's*
 *   element registry, which is a different thing from the React renderer registry — the
 *   kernel's plugin resolves an element's contribution, ours renders one, and feature 003
 *   kept them separate to stop React types reaching `@cuestack/core`. Only the adapter knows
 *   which types it can draw.
 *
 * - **A question that can never be completed.** `reachability` answers about the advance
 *   *rule*; whether a particular learner has exhausted a particular question is session
 *   state, which the kernel deliberately does not hold.
 *
 * Detected here, described by the same table, presented by the same component. Three
 * detections, one presentation — which is the part that must not fragment, since it is the
 * part a learner reads.
 */
export function detectAdapterProblem(
  state: RenderState,
  renderers: ElementRendererRegistry,
  interactions: InteractionState,
): BlockingProblem | null {
  for (const element of state.elements) {
    if (element.type !== 'question') continue
    const definition = element.payload as Interaction
    if (definition?.required !== true) continue

    if (!renderers.has(element.type)) {
      return {
        code: 'UNKNOWN_REQUIRED_INTERACTION',
        elementId: element.id,
        message: `No renderer is registered for required interaction type "${element.type}".`,
      }
    }

    if (interactions.outcomeOf(element.id, definition).unsatisfiable) {
      return {
        code: 'ADVANCE_UNSATISFIABLE',
        elementId: element.id,
        message: 'A required question can no longer be completed, so the slide cannot advance.',
      }
    }
  }
  return null
}

/**
 * How long a media-gated slide waits for its media to attach before saying so.
 *
 * Not zero, because an element enters the render state one commit before its node is
 * registered, and reporting on that frame would flash an alert on every media slide. Not
 * long, because until it fires the learner is looking at a slide that will never move.
 */
export const MEDIA_ATTACH_GRACE_MS = 1000

/**
 * A slide gated on media that never attached.
 *
 * `reachability` catches media that reports `failed`, and media that is the wrong type or
 * absent from the manifest. It cannot catch this one: the port returns `null`, meaning "no
 * media element for that id", which at slide entry is indistinguishable from "not mounted
 * yet" — and the kernel has no clock with which to tell them apart.
 *
 * It is not hypothetical. The reference lesson's assets are opaque ids; a host that supplies
 * no resolver gets a reserved-space fallback and **no `<video>` at all**, so the slide waits
 * forever in silence. The no-stranding sweep found exactly that.
 *
 * Separate from `detectAdapterProblem` because it is the one detection that needs a clock,
 * and the clock is not available where a component renders. The player does not re-render as
 * time passes — that is what the frame writer exists to avoid — so a render-time reading of
 * `slideTimeMs` is whatever it was at the last commit, which for a stalled slide is zero
 * forever. This is called from the frame loop instead, where the time is live.
 */
export function detectMediaAttachFailure(
  state: RenderState,
  slide: Slide,
  media: MediaPort,
  slideTimeMs: number,
): BlockingProblem | null {
  const advance = slide.advance
  if (
    advance?.mode === 'after_media_ends' &&
    slideTimeMs >= MEDIA_ATTACH_GRACE_MS &&
    media.query(advance.mediaElementId) == null &&
    state.elements.some((e) => e.id === advance.mediaElementId)
  ) {
    return {
      code: 'ADVANCE_MEDIA_FAILED',
      elementId: advance.mediaElementId,
      message: 'The media this slide waits for is not available to play.',
    }
  }
  return null
}
