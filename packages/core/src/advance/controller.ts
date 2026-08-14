import type { Slide } from '@cuestack/schema'
import type { Ports } from '../ports/index.js'
import type { MediaPort } from '../ports/media.js'
import type { BlockingProblem } from '../resolve/state.js'
import type { TransportSnapshot } from '../time/transport.js'
import {
  durationElapsed,
  hasIncompleteRequiredInteraction,
  interactionCompleted,
  mediaEnded,
  type AdvanceSignals,
  type ConditionContext,
} from './conditions.js'
import { checkReachability } from './reachability.js'

export type { AdvanceSignals } from './conditions.js'

export type AdvanceCause =
  | 'duration'
  | 'learner_action'
  | 'media_ended'
  | 'interaction_completed'
  | 'override'

export interface AdvanceDecision {
  readonly instanceId: string
  readonly cause: AdvanceCause
  readonly atSlideTimeMs: number
}

export interface AdvanceControllerOptions {
  /**
   * Test-only. Defaults to false so forgetting the option is safe: a test
   * affordance that leaks into playback is worse than none, because it will
   * eventually fire by accident (FR-024).
   */
  readonly allowOverride?: boolean
}

export interface AdvanceController {
  /**
   * A query, not a command: it decides nothing about *doing* the advance. The
   * consumer applies it via the transport. Splitting them lets a test assert the
   * decision without a transport, and lets the editor show "would advance now"
   * without advancing.
   */
  evaluate(slide: Slide, transport: TransportSnapshot, signals: AdvanceSignals): AdvanceDecision | null
  /** Whether this slide's advance rule can ever be satisfied (FR-023). */
  reachability(slide: Slide, media?: MediaPort): BlockingProblem | null
  reset(instanceId: string): void
}

const NULL_MEDIA: MediaPort = {
  query: () => null,
  subscribe: () => () => undefined,
}

export function createAdvanceController(
  ports: Pick<Ports, 'media'> | undefined,
  options: AdvanceControllerOptions = {},
): AdvanceController {
  const media = ports?.media ?? NULL_MEDIA
  /**
   * BR-007 / FR-019: keyed on slide *instance*, not slide id. Keying on the id
   * would break a learner navigating backward and replaying a slide, which must
   * be able to advance again (research R-05).
   */
  const decided = new Set<string>()

  return {
    evaluate(slide, transport, signals) {
      if (decided.has(transport.instanceId)) return null

      const ctx: ConditionContext = {
        slide,
        slideTimeMs: transport.slideTimeMs,
        signals,
        media,
      }

      const decide = (cause: AdvanceCause): AdvanceDecision => {
        decided.add(transport.instanceId)
        return { instanceId: transport.instanceId, cause, atSlideTimeMs: transport.slideTimeMs }
      }

      // The override short-circuits everything, and only when explicitly enabled.
      if (options.allowOverride === true && signals.overrideAdvance === true) {
        return decide('override')
      }

      // BR-005: this outranks every automatic condition below. A learner who has
      // not answered a required question keeps the slide, whatever the clock says.
      if (hasIncompleteRequiredInteraction(ctx)) return null

      const advance = slide.advance
      if (advance.mode === 'after_duration' && durationElapsed(ctx)) return decide('duration')
      if (advance.mode === 'on_click' && signals.learnerAdvanced) return decide('learner_action')
      if (advance.mode === 'after_media_ends' && mediaEnded(ctx, advance.mediaElementId)) {
        return decide('media_ended')
      }
      if (
        advance.mode === 'after_interaction' &&
        interactionCompleted(ctx, advance.interactionElementId)
      ) {
        return decide('interaction_completed')
      }

      return null
    },

    reachability(slide, mediaOverride) {
      return checkReachability(slide, mediaOverride ?? media)
    },

    reset(instanceId) {
      decided.delete(instanceId)
    },
  }
}
