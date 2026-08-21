import type { Slide } from '@cuestack/schema'
import type { BlockingProblem } from '../resolve/state.js'
import type { MediaPort } from '../ports/media.js'
import { findElement, isRequiredQuestion } from './conditions.js'

/** The slide's elements, typed. Mirrors `conditions.ts`, which keeps its own copy private. */
const elementsOf = (slide: Slide): readonly { id: string; type: string; payload?: unknown }[] =>
  slide.elements as readonly { id: string; type: string; payload?: unknown }[]

const MEDIA_TYPES = new Set(['video', 'audio'])

/**
 * FR-023 / SC-012: an advance rule that can never be satisfied is reported.
 *
 * Without this, a learner staring at a stalled slide and a learner on a
 * deliberately-manual slide look identical — to them and to the host.
 */
export function checkReachability(slide: Slide, media?: MediaPort): BlockingProblem | null {
  const advance = slide.advance

  if (advance.mode === 'after_media_ends') {
    const target = findElement(slide, advance.mediaElementId)
    if (!target) {
      return {
        code: 'ADVANCE_UNSATISFIABLE',
        message:
          `This slide advances when media "${advance.mediaElementId}" ends, but no such element ` +
          'exists on it, so it would never advance.',
      }
    }
    if (!MEDIA_TYPES.has(target.type)) {
      return {
        code: 'ADVANCE_UNSATISFIABLE',
        elementId: target.id,
        message:
          `This slide advances when media "${target.id}" ends, but that element is a ` +
          `${target.type}, which never ends.`,
      }
    }
    if (media?.query(target.id)?.failed === true) {
      return {
        code: 'ADVANCE_MEDIA_FAILED',
        elementId: target.id,
        message:
          `The media "${target.id}" that gates this slide failed to load. Reporting rather than ` +
          'waiting for something that will never arrive.',
      }
    }
  }

  if (advance.mode === 'after_interaction') {
    const target = findElement(slide, advance.interactionElementId)
    if (target === undefined || !isRequiredQuestion(target)) {
      return {
        code: 'ADVANCE_UNSATISFIABLE',
        ...(target ? { elementId: target.id } : {}),
        message:
          `This slide advances when interaction "${advance.interactionElementId}" completes, but ` +
          'that element is not a required question, so completion would never gate progression.',
      }
    }
    // FR-INT-011: a required interaction must not disappear before it can be
    // answered — a slide that outlives its own question can never advance.
    if (target.endMs < slide.durationMs) {
      return {
        code: 'ADVANCE_UNSATISFIABLE',
        elementId: target.id,
        message:
          `Required interaction "${target.id}" disappears at ${target.endMs}ms but the slide runs ` +
          `until ${slide.durationMs}ms, so after it vanishes the learner can never satisfy the ` +
          'condition that would move them on.',
      }
    }
  }

  if (advance.mode === 'on_click') {
    /**
     * A slide that continues when the learner asks needs something for them to ask *with*.
     *
     * **This is a rule the engine used to state confidently the other way**, under a test named
     * "reports nothing for the two rules that cannot be unsatisfiable". The premise — a learner can
     * always click — is sound in general and was false in this framework: nothing raised the
     * signal, and the player's controls offer play, pause and seek but no next. A teacher authored
     * such a slide, validation passed it, publishing accepted it, and every learner stopped there
     * permanently with no problem reported, precisely because the check was certain this mode
     * could not strand anyone.
     *
     * The control has to be on the slide, exactly as `after_media_ends` requires its media and
     * `after_interaction` its question. The framework does not supply one: the manifest is the
     * source of truth, and a player-supplied affordance would be absent for any host that embeds
     * the player without its optional controls.
     */
    const buttons = elementsOf(slide).filter((element) => element.type === 'button')
    const advances = buttons.some(
      (element) => (element.payload as { action?: string } | undefined)?.action === 'next_slide',
    )

    if (!advances) {
      /**
       * Two messages, because they are two mistakes and the second is the harder to see.
       *
       * An author looking at a slide with a Back button on it, reading "no way to continue", will
       * read that as a fault in the checker rather than in their lesson.
       */
      return buttons.length === 0
        ? {
            code: 'ADVANCE_UNSATISFIABLE',
            message:
              'This slide continues when the learner asks to move on, but carries no control for ' +
              'them to ask with, so it would never advance. Add a button whose action is ' +
              '"next_slide".',
          }
        : {
            code: 'ADVANCE_UNSATISFIABLE',
            message:
              `This slide continues when the learner asks to move on, and its ${buttons.length} ` +
              `button${buttons.length === 1 ? '' : 's'} do not move them forward — going back or ` +
              'replaying leaves the slide unfinished. Add a button whose action is "next_slide".',
          }
    }
  }

  return null
}

