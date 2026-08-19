import type { LessonManifest } from '@cuestack/schema'
import { lessonOf } from './lesson.js'

/**
 * Lessons with something deliberately wrong, one fault each.
 *
 * One fault per lesson on purpose. A fixture carrying three problems tests that the engine
 * finds *a* problem; a fixture carrying one tests that it finds *that* problem, and a
 * regression in any single rule shows up as a named failure rather than as a count that moved.
 *
 * `correct()` is the control, and it earns its place: an engine that reported everything would
 * pass every other assertion in this feature.
 */

type Element = LessonManifest['slides'][number]['elements'][number]

const base = (): LessonManifest => lessonOf({ slides: 1 })

/** The format's asset reference, which is a record rather than a bare id. */
const IMAGE_ASSET = { assetId: 'asset_1', mimeType: 'image/png' }

const element = (over: Record<string, unknown>): Element =>
  ({
    id: 'e1',
    type: 'text',
    x: 0,
    y: 0,
    width: 400,
    height: 80,
    zIndex: 0,
    startMs: 0,
    endMs: 8000,
    payload: { text: 'content' },
    ...over,
  }) as unknown as Element

function withElements(elements: Element[], slideOver: Record<string, unknown> = {}): LessonManifest {
  const lesson = base()
  const slide = { ...lesson.slides[0]!, elements, ...slideOver }
  return { ...lesson, slides: [slide] } as LessonManifest
}

/** A required question that can never be completed: `on_correct` with the attempts capped. */
export const deadEnd = (): LessonManifest =>
  withElements([
    element({
      id: 'q1',
      type: 'question',
      payload: {
        interactionType: 'multiple_choice',
        prompt: 'Which one?',
        options: [
          { id: 'a', label: 'First' },
          { id: 'b', label: 'Second' },
        ],
        correctResponse: 'a',
        required: true,
        completionPolicy: 'on_correct',
        maxAttempts: 1,
      },
    }),
  ])

/** The same question with unlimited attempts — reachable, and therefore not a dead end. */
export const answerable = (): LessonManifest =>
  withElements([
    element({
      id: 'q1',
      type: 'question',
      payload: {
        interactionType: 'multiple_choice',
        prompt: 'Which one?',
        options: [
          { id: 'a', label: 'First' },
          { id: 'b', label: 'Second' },
        ],
        correctResponse: 'a',
        required: true,
        completionPolicy: 'on_correct',
      },
    }),
  ])

/**
 * A slide that advances on media that is not media.
 *
 * **Both tiers report this one**, and that is the fixture's second use: the schema's Tier 2 says
 * `ADVANCE_MEDIA_WRONG_TYPE` and `checkReachability` says `ADVANCE_UNSATISFIABLE`. The overlap was
 * known before this feature — it is the reason the engine composes rather than checks — and a
 * fixture that hid it would hide the thing worth watching.
 */
export const advanceOnNonMedia = (): LessonManifest =>
  withElements([element({ id: 'notMedia' })], {
    advance: { mode: 'after_media_ends', mediaElementId: 'notMedia' },
  })

/** An element scheduled past the end of its slide. */
export const beyondSlide = (): LessonManifest =>
  withElements([element({ endMs: 12_000 })])

/** An image with no alt text — a common field, so the engine's rule rather than a plugin's. */
export const noAltText = (): LessonManifest =>
  withElements([element({ id: 'img', type: 'image', payload: { asset: IMAGE_ASSET } })])

/**
 * A question whose two answers read the same.
 *
 * This fixture was originally a *one-option* question, on the belief that the format permitted it.
 * It does not — `interactionSchema` declares `options: ...min(2)` — so that lesson exercised the
 * schema tier and never reached the plugin it was written for. Indistinguishable labels are the
 * genuine gap: the format enforces unique option **ids** and says nothing about what they say.
 */
export const indistinguishableOptions = (): LessonManifest =>
  withElements([
    element({
      id: 'q1',
      type: 'question',
      payload: {
        interactionType: 'multiple_choice',
        prompt: 'Which one?',
        options: [
          { id: 'a', label: 'Paris' },
          { id: 'b', label: 'paris ' },
        ],
        correctResponse: 'a',
        required: false,
      },
    }),
  ])

/** Nothing wrong with it at all. The control every other fixture is measured against. */
export const correct = (): LessonManifest =>
  withElements([
    element({ accessibility: { label: 'A heading' } }),
    element({
      id: 'img',
      type: 'image',
      payload: { asset: IMAGE_ASSET },
      accessibility: { altText: 'A diagram' },
    }),
  ])
