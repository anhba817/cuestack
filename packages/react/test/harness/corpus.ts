import type { LessonManifest, Slide } from '@cuestack/schema'
import reference from '@cuestack/schema/fixtures/valid/reference.json' with { type: 'json' }

/**
 * Slides for rendering tests. The reference manifest plus cases the reference does
 * not contain: every element type on one slide, an off-canvas element, and a theme
 * that omits a token a renderer wants.
 */

export const referenceLesson = reference as unknown as LessonManifest

let seq = 0
const id = (p: string) => `${p}_${++seq}`

export function element(overrides: Record<string, unknown> = {}): Slide['elements'][number] {
  return {
    id: id('el'),
    type: 'text',
    x: 100,
    y: 100,
    width: 400,
    height: 80,
    zIndex: 1,
    startMs: 0,
    endMs: 8000,
    payload: { text: 'content' },
    ...overrides,
  } as unknown as Slide['elements'][number]
}

export function slide(elements: Slide['elements'], overrides: Record<string, unknown> = {}): Slide {
  return {
    id: id('slide'),
    durationMs: 8000,
    advance: { mode: 'after_duration' },
    elements,
    ...overrides,
  } as unknown as Slide
}

export function lessonOf(
  slides: Slide[],
  theme: Record<string, string | number> = {},
  // Lesson-level overrides — `aspectRatio` above all, since US3 #5 is about a lesson
  // authored at a ratio other than the default.
  lesson: Record<string, unknown> = {},
): LessonManifest {
  return {
    schemaVersion: '1.0',
    lesson: {
      id: 'lesson_render_test',
      title: 'Render Test',
      language: 'en',
      aspectRatio: '16:9',
      ...(Object.keys(theme).length > 0 ? { themeId: 'test' } : {}),
      ...lesson,
    },
    slides,
  } as unknown as LessonManifest
}

const asset = (mimeType: string, extra: Record<string, unknown> = {}) => ({
  assetId: 'asset_1',
  mimeType,
  ...extra,
})

/** One slide carrying all seven element types. */
export function allTypesSlide(): Slide {
  return slide([
    element({ id: 'el_text', type: 'text', zIndex: 1, payload: { text: 'Some words' } }),
    element({
      id: 'el_image',
      type: 'image',
      zIndex: 2,
      payload: { asset: asset('image/webp', { width: 1200, height: 900 }), caption: 'A caption' },
      accessibility: { altText: 'A worker wearing safety equipment' },
    }),
    element({ id: 'el_shape', type: 'shape', zIndex: 3, payload: { shape: 'rect' } }),
    element({
      id: 'el_video',
      type: 'video',
      zIndex: 4,
      payload: {
        asset: asset('video/mp4', { width: 1920, height: 1080, durationMs: 5000, captionTrack: 'cap_1' }),
        showControls: true,
      },
    }),
    element({
      id: 'el_audio',
      type: 'audio',
      zIndex: 5,
      payload: { asset: asset('audio/mpeg', { durationMs: 5000, transcript: 'tr_1' }), showControls: true },
    }),
    element({ id: 'el_button', type: 'button', zIndex: 6, payload: { label: 'Continue', action: 'next_slide' } }),
    element({
      id: 'el_question',
      type: 'question',
      zIndex: 7,
      payload: {
        interactionType: 'true_false',
        prompt: 'Near-misses must be reported.',
        options: [
          { id: 'yes', label: 'True' },
          { id: 'no', label: 'False' },
        ],
        correctResponse: 'yes',
        required: false,
      },
    }),
  ])
}

/**
 * Wave 3 fixtures.
 *
 * Twelve lessons, each named for what it puts under test. They live here rather than inline
 * because a test that builds its own fixture describes the fixture, not the behaviour — and
 * because two tests building "a required question" separately will eventually build two
 * different ones.
 *
 * Manifest facts only. How a media element *behaves* — reporting zero duration, never
 * reporting an end, failing — is scripted by the media fake in `harness/media.ts`, since a
 * manifest can declare a duration but cannot declare that a file lies about one.
 */

const QUESTION_OPTIONS = [
  { id: 'a', label: 'A near-miss' },
  { id: 'b', label: 'Nothing' },
]

/** A question element. Required and unlimited-attempts unless overridden. */
export function questionElement(overrides: Record<string, unknown> = {}): Slide['elements'][number] {
  const { payload = {}, ...rest } = overrides as { payload?: Record<string, unknown> }
  return element({
    type: 'question',
    effects: [],
    payload: {
      interactionType: 'multiple_choice',
      prompt: 'Which of these must be reported?',
      options: QUESTION_OPTIONS,
      correctResponse: 'a',
      required: true,
      ...payload,
    },
    ...rest,
  })
}

/** A media element, with the manifest-side settings the edge cases need. */
export function mediaElement(overrides: Record<string, unknown> = {}): Slide['elements'][number] {
  const { payload = {}, ...rest } = overrides as { payload?: Record<string, unknown> }
  return element({
    type: 'video',
    effects: [],
    payload: {
      asset: {
        assetId: 'https://example.test/clip.mp4',
        mimeType: 'video/mp4',
        width: 1920,
        height: 1080,
        durationMs: 5000,
      },
      showControls: true,
      ...payload,
    },
    ...rest,
  })
}

/* ---- For the stories ---- */

/** A required question that holds the slide (BR-005, Scenario B). */
export const requiredQuestionLesson = (): LessonManifest =>
  lessonOf([slide([questionElement({ id: 'q_required' })], { durationMs: 10_000 })])

/** An optional question, which must not hold it. */
export const optionalQuestionLesson = (): LessonManifest =>
  lessonOf([
    slide([questionElement({ id: 'q_optional', payload: { required: false } })], { durationMs: 10_000 }),
  ])

/** `on_correct` with one attempt: answer wrongly and it can never complete. */
export const deadEndQuestionLesson = (): LessonManifest =>
  lessonOf([
    slide(
      [questionElement({ id: 'q_dead_end', payload: { completionPolicy: 'on_correct', maxAttempts: 1 } })],
      { durationMs: 10_000 },
    ),
  ])

/** Advances only when its video ends (Scenario C). */
export const mediaGatedLesson = (): LessonManifest =>
  lessonOf([
    slide([mediaElement({ id: 'el_video' })], {
      durationMs: 8000,
      advance: { mode: 'after_media_ends', mediaElementId: 'el_video' },
    }),
    slide([element({ id: 'after', effects: [] })], { durationMs: 4000 }),
  ])

/** Two slides, the second arriving with an authored transition. */
export const transitionLesson = (): LessonManifest =>
  lessonOf([
    slide([element({ id: 'first', effects: [] })], { durationMs: 8000 }),
    slide([element({ id: 'second', effects: [] })], {
      durationMs: 8000,
      transition: { type: 'slide', durationMs: 400 },
    }),
  ])

/** An element cued to media position rather than to slide time (FR-013). */
export const mediaCuedLesson = (): LessonManifest =>
  lessonOf([
    slide([mediaElement({ id: 'el_video' }), element({ id: 'caption', startMs: 2000, endMs: 8000, effects: [] })], {
      durationMs: 8000,
    }),
  ])

/* ---- For the edge cases ---- */

/** A required question that vanishes before the slide ends. Must not deadlock. */
export const vanishingQuestionLesson = (): LessonManifest =>
  lessonOf([
    slide([questionElement({ id: 'q_vanishes', startMs: 0, endMs: 3000 })], { durationMs: 10_000 }),
  ])

/** Muted media — `volume: 0` is a manifest field, so it belongs here. No gesture needed. */
export const mutedMediaLesson = (): LessonManifest =>
  lessonOf([
    slide([mediaElement({ id: 'el_video', payload: { volume: 0 } })], {
      durationMs: 8000,
      advance: { mode: 'after_media_ends', mediaElementId: 'el_video' },
    }),
  ])

/** One slide. Progress and completion both have to mean something at n=1. */
export const singleSlideLesson = (): LessonManifest =>
  lessonOf([slide([element({ id: 'only', effects: [] })], { durationMs: 4000 })])

/** A transition longer than the slide it moves to. */
export const overlongTransitionLesson = (): LessonManifest =>
  lessonOf([
    slide([element({ id: 'first', effects: [] })], { durationMs: 4000 }),
    slide([element({ id: 'second', effects: [] })], {
      durationMs: 1000,
      transition: { type: 'fade', durationMs: 3000 },
    }),
  ])

/** The final slide gates on a question. Is the lesson completable? */
export const gatedFinalSlideLesson = (): LessonManifest =>
  lessonOf([
    slide([element({ id: 'intro', effects: [] })], { durationMs: 2000 }),
    slide([questionElement({ id: 'q_final' })], { durationMs: 4000 }),
  ])

export interface CorpusEntry {
  name: string
  lesson: LessonManifest
}

export function corpus(): CorpusEntry[] {
  return [
    { name: 'reference lesson', lesson: referenceLesson },
    { name: 'all element types', lesson: lessonOf([allTypesSlide()]) },
    {
      name: 'element off-canvas',
      lesson: lessonOf([slide([element({ x: 1900, y: -200, effects: [] })])]),
    },
    {
      name: 'element entering later',
      lesson: lessonOf([slide([element({ id: 'later', startMs: 500, endMs: 8000, effects: [] })])]),
    },
    { name: 'empty slide', lesson: lessonOf([slide([])]) },
    {
      name: 'unregistered optional type',
      lesson: lessonOf([
        slide([
          element({ id: 'known', effects: [] }),
          element({ id: 'exotic', type: 'hologram', effects: [], payload: {} }),
        ]),
      ]),
    },
  ]
}
