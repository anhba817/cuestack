import type { Slide } from '@cuestack/schema'
import type { BlockingProblem } from '../resolve/state.js'
import type { MediaPort } from '../ports/media.js'
import { findElement, isRequiredQuestion } from './conditions.js'

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

  return null
}
